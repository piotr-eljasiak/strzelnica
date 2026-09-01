import { openDatabase } from '../db/connection.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 5173);
const { listen } = createApp({ db: openDatabase() });

listen(port);
console.log(`API listening on http://localhost:${port}`);
