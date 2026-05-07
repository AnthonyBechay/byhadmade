import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Recipes from './pages/Recipes';
import RecipeDetail from './pages/RecipeDetail';
import Menus from './pages/Menus';
import MenuDetail from './pages/MenuDetail';
import Ingredients from './pages/Ingredients';
import Scheduling from './pages/Scheduling';
import ScheduleDetail from './pages/ScheduleDetail';
import Salaries from './pages/Salaries';
import PublicSchedule from './pages/PublicSchedule';
import Orders from './pages/Orders';
import Traceability from './pages/Traceability';
import Checklist from './pages/Checklist';
import Temperature from './pages/Temperature';
import Settings from './pages/Settings';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/schedule/:shareToken" element={<PublicSchedule />} />
        <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="recipes" element={<Recipes />} />
          <Route path="recipes/:id" element={<RecipeDetail />} />
          <Route path="ingredients" element={<Ingredients />} />
          <Route path="menus" element={<Menus />} />
          <Route path="menus/:id" element={<MenuDetail />} />
          <Route path="scheduling" element={<Scheduling />} />
          <Route path="scheduling/:id" element={<ScheduleDetail />} />
          <Route path="scheduling/salaries/:restaurantId" element={<Salaries />} />
          <Route path="orders" element={<Orders />} />
          <Route path="traceability" element={<Traceability />} />
          <Route path="checklists" element={<Checklist />} />
          <Route path="temperatures" element={<Temperature />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
