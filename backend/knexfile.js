// knexfile.js - Knex数据库配置文件
require('dotenv').config();

/**
 * 验证必需的环境变量
 * @description 生产环境必须设置数据库密码，避免安全隐患
 */
function validateRequiredEnv() {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.error('❌ 缺少必需的环境变量:', missing.join(', '));
    console.error('请在 .env 文件或系统环境变量中设置这些变量');
    process.exit(1);
  }
}

validateRequiredEnv();

/**
 * 基础数据库配置
 * @description 统一配置，避免重复
 */
const baseConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'nfunest',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4'
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  },
  acquireConnectionTimeout: 60000,
  useNullAsDefault: true
};

module.exports = {
  development: {
    ...baseConfig
  },

  production: {
    ...baseConfig,
    connection: {
      ...baseConfig.connection,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      ...baseConfig.pool,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false
    }
  }
};