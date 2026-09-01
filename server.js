const app = require('./app');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Bakery order system API listening on port ${port}`);
});
