import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import router from './route/scrapper';
const app: Express = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(helmet());
app.use(cors({
  origin:'*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', router);
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/', (_req, res) => {
    const data = {
        title: 'Welcome to EJS!',
        user: 'John Doe',
        items: ['Apple', 'Banana', 'Orange']
    };
    res.render('index', data);
})
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;