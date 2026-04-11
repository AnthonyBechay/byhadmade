import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import ingredientRoutes from './routes/ingredients';
import recipeRoutes from './routes/recipes';
import menuRoutes from './routes/menus';
import restaurantRoutes from './routes/restaurants';
import employeeRoutes from './routes/employees';
import scheduleRoutes from './routes/schedules';
import orderRoutes from './routes/orders';
import supplierRoutes from './routes/suppliers';
import ingredientSettingsRoutes from './routes/ingredient-settings';
import storageLocationRoutes from './routes/storage-locations';
import traceabilityRoutes from './routes/traceability';
import subAccountRoutes from './routes/sub-accounts';

const prisma = new PrismaClient();

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
app.use('/api/orders', orderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/ingredient-settings', ingredientSettingsRoutes);
app.use('/api/storage-locations', storageLocationRoutes);
app.use('/api/traceability', traceabilityRoutes);
app.use('/api/sub-accounts', subAccountRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve frontend in production
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// OG meta tags for public schedule links (WhatsApp, social media previews)
app.get('/schedule/:shareToken', async (req, res) => {
  try {
    const indexPath = path.join(publicPath, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf-8');

    const restaurant = await prisma.restaurant.findUnique({
      where: { shareToken: req.params.shareToken as string },
    });

    if (restaurant) {
      const title = `${restaurant.name} — Weekly Schedule`;
      const description = `View the current weekly employee schedule for ${restaurant.name}`;
      const url = `https://byhadmade.com/schedule/${req.params.shareToken}`;
      const logoUrl = restaurant.logoUrl
        ? `https://byhadmade.com${restaurant.logoUrl}`
        : 'https://byhadmade.com/logo.png';

      const ogTags = `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:site_name" content="ByHadMade" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${logoUrl}" />`;

      // Inject OG tags before </head> and update <title>
      html = html.replace('</head>', `${ogTags}\n  </head>`);
      html = html.replace('<title>ByHadMade</title>', `<title>${title}</title>`);
      html = html.replace(
        '<meta name="description" content="ByHadMade - Where Flavor Meets Artistry" />',
        `<meta name="description" content="${description}" />`
      );
    }

    res.send(html);
  } catch (error) {
    // Fallback: just serve the normal index.html
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
