import asyncio
import smtplib
import unittest
from unittest.mock import patch, MagicMock, AsyncMock
import httpx
from pydantic import ValidationError
from config import Settings
from email_service import Delivery, message, send
from scheduler import Worker

def config():
    return Settings(internal_secret='synthetic-secret-for-tests-32-bytes')

def delivery():
    return Delivery(id='00000000-0000-4000-8000-000000000001', kind='assigned',
        recipient='member@example.invalid', recipientName='Sintético', title='<script>unsafe()</script>\r\nBcc: bad',
        project='A & B', projectId=1, dueDate=None, messageId='<00000000-0000-4000-8000-000000000001@synkro.local>')

class EmailTests(unittest.TestCase):
    def test_configuration_and_payload(self):
        with self.assertRaises(ValidationError):
            Settings(internal_secret='short')
        with self.assertRaises(ValidationError):
            Settings(internal_secret='x'*32, smtp_user='user', smtp_password='secret')
        with self.assertRaises(ValidationError):
            Delivery.model_validate({**delivery().model_dump(), 'recipient': 'a@b.com\r\nBcc: c@d.com'})
        self.assertIsNone(delivery().dueDate)

    def test_template_escaping(self):
        msg = message(delivery(), config())
        self.assertIsNone(msg['Bcc'])
        self.assertIn('Sin vencimiento', msg.get_body(preferencelist=('plain',)).get_content())
        html = msg.get_body(preferencelist=('html',)).get_content()
        self.assertIn('&lt;script&gt;', html)
        self.assertNotIn('<script>', html)

    @patch('email_service.smtplib.SMTP')
    def test_acceptance_not_reversed_by_close(self, factory):
        smtp = factory.return_value
        smtp.mail.return_value = smtp.rcpt.return_value = (250, b'ok')
        smtp.data.return_value = (250, b'accepted')
        self.assertEqual(send(delivery(), config())[0], 'accepted')
        smtp.close.assert_called_once()
        self.assertEqual(factory.call_args.kwargs['timeout'], 5)

    @patch('email_service.smtplib.SMTP')
    def test_timeout_after_data_is_unknown(self, factory):
        smtp = factory.return_value
        smtp.mail.return_value = smtp.rcpt.return_value = (250, b'ok')
        smtp.data.side_effect = TimeoutError()
        self.assertEqual(send(delivery(), config())[0], 'unknown')
        smtp.close.assert_called_once()
        factory.side_effect = TimeoutError()
        self.assertEqual(send(delivery(), config())[0], 'temporary')

    @patch('email_service.smtplib.SMTP')
    def test_permanent_rejection(self, factory):
        factory.return_value.mail.return_value = (550, b'sensitive message never stored')
        factory.return_value.rcpt.return_value = (550, b'rejected')
        self.assertEqual(send(delivery(), config()), ('permanent', 'SMTP_PERMANENT'))
        factory.return_value.data.assert_not_called()

class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def test_confirmation_retry_never_repeats_smtp(self):
        worker = Worker(config())
        worker.post = AsyncMock(side_effect=[{'data': delivery().model_dump(mode='json')}, httpx.ConnectError('offline'), {}])
        with patch('scheduler.send', return_value=('accepted','SMTP_ACCEPTED')) as smtp:
            await worker.process({'id': str(delivery().id), 'claimToken': 'synthetic'})
            smtp.assert_called_once()
            self.assertEqual(worker.post.await_count, 3)
        await worker.close()

    async def test_shutdown_waits_current_cycle(self):
        worker = Worker(config())
        entered = asyncio.Event()
        release = asyncio.Event()
        async def cycle():
            entered.set()
            await release.wait()
        worker.cycle = cycle
        task = asyncio.create_task(worker.run())
        await entered.wait()
        worker.stop.set()
        self.assertFalse(task.done())
        release.set()
        await asyncio.wait_for(task, 1)
        await worker.close()

if __name__ == '__main__':
    unittest.main()
