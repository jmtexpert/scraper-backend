
import app from './app';
import { ENV } from './config/env';
const PORT  = Number(ENV.PORT || 3000)
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => { 
  console.log(`Server running on http://${HOST}:${PORT}`);
});