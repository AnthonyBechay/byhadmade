import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import ingredientRoutes from './routes/ingredients';
import recipeRoutes from './routes/recipes';
import menuRoutes from './routes/menus';
import restaurantRoutes from './routes/restaurants';
import employeeRoutes from './routes/employees';
import scheduleRoutes from './routes/schedules';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/schedules', scheduleRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve frontend in production
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
