import { Request, Response, NextFunction } from 'express'
// Importamos las funciones específicas para evitar el error de "Property does not exist"
import { getDashboard as fetchDashboard, getProjectSummary as fetchProjectSummary } from '../services/dashboard.service'

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Extraer el ID del usuario de forma segura
    // Verificamos ambas posibilidades según cómo esté configurado tu authMiddleware
    const userId = (req as any).user?.id || (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // 2. Llamar al servicio con el ID normalizado
    const data = await fetchDashboard(Number(userId));
    
    // 3. Responder con la estructura que el frontend Dashboard.tsx espera
    res.json({ data });
  } catch (err) { 
    console.error("Error en getDashboard Controller:", err);
    next(err); 
  }
}

export const getProjectSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = Number(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'ID de proyecto no válido' });
    }

    const data = await fetchProjectSummary(projectId);
    
    // Si el servicio devuelve un error de función SQL, lo manejamos
    if ((data as any).error) {
      return res.status(500).json(data);
    }

    res.json(data);
  } catch (err) { 
    console.error("Error en getProjectSummary Controller:", err);
    next(err); 
  }
}