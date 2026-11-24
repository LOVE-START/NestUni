// config/database.js - 数据库配置
const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

const db = knex(config);

// 测试数据库连接
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ 数据库连接成功');
  })
  .catch((err) => {
    console.error('❌ 数据库连接失败:', err.message);
    process.exit(1);
  });

module.exports = db;