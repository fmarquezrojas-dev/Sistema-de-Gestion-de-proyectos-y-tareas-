/**
 * frontend/src/components/KanbanBoard.tsx
 *
 * Tablero Kanban con drag & drop real usando @dnd-kit/core.
 *
 * Instalar dependencias:
 *   npm install @dnd-kit/core @dnd-kit/utilities
 *
 * Props:
 *   tasks          → array de tareas del usuario (ya filtradas desde Tasks.tsx)
 *   onStatusChange → callback para actualizar estado (optimistic en Tasks.tsx)
 *   now            → fecha actual para badges de vencimiento
 */

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  TouchSensor,
  useSensors,
  useSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
//import { Link } from 'react-router-dom'
import type { Task } from '../types'

// ─── Metadatos de columnas ────────────────────────────────────────────────────
const COLUMNS = [
  {
    id:       'PENDING',
    label:    'Pendiente',
    icon:     '⏳',
    color:    '#f59e0b',
    bg:       '#fffbeb',
    border:   '#fde68a',
    textColor:'#92400e',
    dot:      '#f59e0b',
  },
  {
    id:       'IN_PROGRESS',
    label:    'En progreso',
    icon:     '🔄',
    color:    '#6366f1',
    bg:       '#eef2ff',
    border:   '#c7d2fe',
    textColor:'#3730a3',
    dot:      '#6366f1',
  },
  {
    id:       'COMPLETED',
    label:    'Completada',
    icon:     '✅',
    color:    '#22c55e',
    bg:       '#f0fdf4',
    border:   '#bbf7d0',
    textColor:'#15803d',
    dot:      '#22c55e',
  },
] as const

type ColId = (typeof COLUMNS)[number]['id']

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e',
}
const PRIORITY_LABEL: Record<string, string> = {
  HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja',
}

// ─── Helper de fecha ──────────────────────────────────────────────────────────
const getDueBadge = (
  dueDate: string | undefined,
  status: string,
  now: Date,
): { label: string; color: string } | null => {
  if (!dueDate || status === 'COMPLETED') return null
  const mins  = Math.floor((new Date(dueDate).getTime() - now.getTime()) / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins < 0)    return { label: `Venció hace ${Math.abs(days) > 0 ? Math.abs(days) + 'd' : Math.abs(hours) + 'h'}`, color: '#ef4444' }
  if (mins <= 60)  return { label: `${mins}min`,       color: '#ef4444' }
  if (hours < 24)  return { label: 'Hoy',              color: '#f59e0b' }
  if (days === 1)  return { label: 'Mañana',           color: '#fb923c' }
  if (days <= 3)   return { label: `${days}d`,         color: '#fb923c' }
  return                   { label: `${days}d`,         color: '#94a3b8' }
}

// ─── Task Card Draggable ──────────────────────────────────────────────────────
const KanbanTaskCard = ({
  task,
  now,
  isOverlay = false,
}: {
  task: Task
  now: Date
  isOverlay?: boolean
}) => {
  const dueDate  = (task as any).dueDate as string | undefined
  const dueBadge = getDueBadge(dueDate, task.status, now)
  const assignee = (task as any).assignee
  const project  = (task as any).project

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   String(task.id),
    data: { task },
    disabled: isOverlay,
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity:   isDragging ? 0.35 : 1,
    cursor:    isDragging ? 'grabbing' : 'grab',
  }

  const cardContent = (
  <div style={{
  borderRadius: '10px',
  padding:      '0.9rem 1rem',
  boxShadow:    isOverlay
    ? '0 12px 32px rgba(0,0,0,0.18)'
    : '0 1px 4px rgba(0,0,0,0.07)',
  border:       isOverlay
    ? '2px solid #6366f1'
    : `1px solid ${dueBadge?.color === '#ef4444' ? '#fecaca' : '#f1f5f9'}`,
  borderLeft:   `4px solid ${PRIORITY_COLOR[task.priority]}`,
  userSelect:   'none',
  transform:    isOverlay ? 'rotate(2deg)' : undefined,
  transition:   'box-shadow 0.15s',
  // Lógica unificada: si vence hoy/venció, tinte rojizo, si no, blanco
  background: (task as any).dueDate && getDueBadge((task as any).dueDate, task.status, now)?.color === '#ef4444'
    ? '#fff8f8'
    : '#fff',
}}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.35, flex: 1 }}>
          {task.title}
        </p>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, color: '#fff',
          background: PRIORITY_COLOR[task.priority],
          padding: '0.1rem 0.45rem', borderRadius: '999px', flexShrink: 0,
        }}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      {/* Descripción */}
      {(task as any).description && (
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.77rem', color: '#64748b',
          lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {(task as any).description}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {/* Proyecto */}
        {project?.name && (
          <span style={{ fontSize: '0.68rem', color: '#4f46e5', background: '#eef2ff',
            padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
            📁 {project.name}
          </span>
        )}

        {/* Fecha límite */}
        {dueBadge && (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: dueBadge.color }}>
            📅 {dueBadge.label}
          </span>
        )}

        {/* Asignado */}
        {assignee && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto' }}>
            {assignee.avatarUrl ? (
              <img src={assignee.avatarUrl} alt={assignee.name}
                style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: assignee.avatarColor || '#4f46e5', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700, flexShrink: 0,
              }}>
                {assignee.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{assignee.name?.split(' ')[0]}</span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {cardContent}
    </div>
  )
}

// ─── Columna Droppable ────────────────────────────────────────────────────────
const KanbanColumn = ({
  col,
  tasks,
  now,
  isDraggingOver,
}: {
  col: typeof COLUMNS[number]
  tasks: Task[]
  now: Date
  isDraggingOver: boolean
}) => {
  const { setNodeRef } = useDroppable({ id: col.id })

  return (
    <div style={{
      flex:         '1 1 300px',
      minWidth:     '270px',
      maxWidth:     '380px',
      display:      'flex',
      flexDirection:'column',
      background:   isDraggingOver ? col.bg : '#f8fafc',
      borderRadius: '14px',
      border:       `2px solid ${isDraggingOver ? col.color : '#e2e8f0'}`,
      transition:   'border-color 0.2s, background 0.2s',
      overflow:     'hidden',
    }}>
      {/* Cabecera de columna */}
      <div style={{
        padding:      '1rem 1.1rem 0.85rem',
        background:   col.bg,
        borderBottom: `2px solid ${col.border}`,
        display:      'flex',
        alignItems:   'center',
        gap:          '0.6rem',
      }}>
        <div style={{
          width:  '10px', height: '10px', borderRadius: '50%',
          background: col.dot, flexShrink: 0,
          boxShadow: isDraggingOver ? `0 0 0 3px ${col.dot}33` : undefined,
        }} />
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: col.textColor, flex: 1 }}>
          {col.icon} {col.label}
        </span>
        <span style={{
          fontSize: '0.72rem', fontWeight: 800, color: col.textColor,
          background: `${col.color}22`, padding: '0.15rem 0.6rem', borderRadius: '999px',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Zona de drop */}
      <div
        ref={setNodeRef}
        style={{
          flex:       1,
          padding:    '0.85rem',
          display:    'flex',
          flexDirection:'column',
          gap:        '0.6rem',
          minHeight:  '120px',
          overflowY:  'auto',
          maxHeight:  'calc(100vh - 280px)',
        }}
      >
        {tasks.length === 0 && (
          <div style={{
            display:     'flex',
            flexDirection:'column',
            alignItems:  'center',
            justifyContent:'center',
            flex:        1,
            padding:     '2rem 1rem',
            color:       '#94a3b8',
            fontSize:    '0.82rem',
            textAlign:   'center',
            border:      `2px dashed ${isDraggingOver ? col.color : '#e2e8f0'}`,
            borderRadius:'10px',
            transition:  'border-color 0.2s',
          }}>
            {isDraggingOver
              ? <><span style={{ fontSize: '1.5rem' }}>{col.icon}</span><span style={{ marginTop: '0.4rem', color: col.color, fontWeight: 600 }}>Soltar aquí</span></>
              : <><span style={{ fontSize: '1.5rem' }}>📭</span><span style={{ marginTop: '0.4rem' }}>Sin tareas</span></>
            }
          </div>
        )}
        {tasks.map(task => (
          <KanbanTaskCard key={task.id} task={task} now={now} />
        ))}
      </div>
    </div>
  )
}

// ─── KanbanBoard principal ────────────────────────────────────────────────────
interface KanbanBoardProps {
  tasks:          Task[]
  onStatusChange: (taskId: number, newStatus: string) => Promise<void>
  now:            Date
}

const KanbanBoard = ({ tasks, onStatusChange, now }: KanbanBoardProps) => {
  const [activeTask,    setActiveTask]    = useState<Task | null>(null)
  const [draggingOverCol, setDraggingOverCol] = useState<string | null>(null)
  const [movingTaskId,  setMovingTaskId]  = useState<number | null>(null)
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null)

  // Sensor con umbral de distancia para no activar drag en clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  )

  // Agrupar tareas por columna
  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.status === col.id)
    return acc
  }, {} as Record<ColId, Task[]>)

  // Estadísticas generales
  const total     = tasks.length
  const completed = grouped['COMPLETED'].length
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task
    setActiveTask(task)
  }

  const handleDragOver = (event: any) => {
    setDraggingOverCol(event.over?.id ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setDraggingOverCol(null)

    if (!over) return

    const task      = active.data.current?.task as Task
    const newStatus = over.id as string

    if (task.status === newStatus) return

    setMovingTaskId(task.id)
    setErrorMsg(null)
    try {
      await onStatusChange(task.id, newStatus)
    } catch {
      setErrorMsg(`No se pudo mover "${task.title}". Intenta de nuevo.`)
      setTimeout(() => setErrorMsg(null), 4000)
    } finally {
      setMovingTaskId(null)
    }
  }

  return (
    <div>
      {/* Barra de progreso global */}
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '1rem 1.5rem',
        marginBottom: '1.25rem', border: '1px solid #f1f5f9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              Progreso general
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: pct === 100 ? '#22c55e' : '#6366f1' }}>
              {pct}%
            </span>
          </div>
          <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              borderRadius: '999px', transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          {COLUMNS.map(col => (
            <div key={col.id} style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: col.color }}>
                {grouped[col.id].length}
              </p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                {col.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Error de movimiento */}
      {errorMsg && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444',
          borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem',
          fontSize: '0.85rem', color: '#dc2626', fontWeight: 500,
        }}>
          ❌ {errorMsg}
        </div>
      )}

      {/* Hint de instrucciones */}
      {total > 0 && (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem', textAlign: 'center' }}>
          💡 Arrastra las tarjetas entre columnas para cambiar su estado
        </p>
      )}

      {/* Tablero */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{
          display:    'flex',
          gap:        '1rem',
          alignItems: 'flex-start',
          overflowX:  'auto',
          paddingBottom: '1rem',
        }}>
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={grouped[col.id]}
              now={now}
              isDraggingOver={draggingOverCol === col.id && activeTask !== null}
            />
          ))}
        </div>

        {/* Overlay: tarjeta fantasma que sigue el cursor */}
        <DragOverlay dropAnimation={{
          duration: 200,
          easing:   'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeTask && (
            <KanbanTaskCard task={activeTask} now={now} isOverlay />
          )}
        </DragOverlay>
      </DndContext>

      {/* Estado vacío */}
      {total === 0 && (
        <div style={{
          textAlign:  'center',
          padding:    '4rem 2rem',
          background: '#fff',
          borderRadius:'14px',
          border:     '1px solid #f1f5f9',
        }}>
          <p style={{ fontSize: '3rem', margin: '0 0 0.75rem' }}>📋</p>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
            Sin tareas que mostrar
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: 0 }}>
            Ajusta los filtros o crea una tarea desde un proyecto
          </p>
        </div>
      )}

      {/* Spinner por tarea moviéndose */}
      {movingTaskId && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          background: '#1e293b', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '999px',
          fontSize: '0.85rem', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 100,
        }}>
          <span style={{
            width: '14px', height: '14px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid #fff',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }} />
          Actualizando estado...
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default KanbanBoard
