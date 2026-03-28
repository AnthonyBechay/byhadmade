import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, UtensilsCrossed, Salad, CalendarDays, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ recipes: 0, menus: 0, ingredients: 0, schedules: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/recipes').catch(() => []),
      api.get('/menus').catch(() => []),
      api.get('/ingredients').catch(() => []),
      api.get('/schedules').catch(() => []),
    ]).then(([recipes, menus, ingredients, schedules]) => {
      setStats({
        recipes: recipes.length,
        menus: menus.length,
        ingredients: ingredients.length,
        schedules: schedules.length,
      });
    });
  }, []);

  const cards = [
    { icon: ChefHat, label: 'Recipes', count: stats.recipes, path: '/app/recipes', color: '#c8956c' },
    { icon: UtensilsCrossed, label: 'Menus', count: stats.menus, path: '/app/menus', color: '#4a9e6a' },
    { icon: Salad, label: 'Ingredients', count: stats.ingredients, path: '/app/ingredients', color: '#d4a035' },
    { icon: CalendarDays, label: 'Schedules', count: stats.schedules, path: '/app/scheduling', color: '#6a9fd4' },
  ];

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to your kitchen workspace</p>
        </div>
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <button key={card.label} className="stat-card" onClick={() => navigate(card.path)}>
            <div className="stat-icon" style={{ background: `${card.color}15`, color: card.color }}>
              <card.icon size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-count">{card.count}</span>
              <span className="stat-label">{card.label}</span>
            </div>
            <ArrowRight size={18} className="stat-arrow" />
          </button>
        ))}
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions">
            <button className="quick-action" onClick={() => navigate('/app/recipes')}>
              <ChefHat size={20} />
              <span>Create Recipe</span>
            </button>
            <button className="quick-action" onClick={() => navigate('/app/menus')}>
              <UtensilsCrossed size={20} />
              <span>Build Menu</span>
            </button>
            <button className="quick-action" onClick={() => navigate('/app/scheduling')}>
              <CalendarDays size={20} />
              <span>Plan Schedule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
