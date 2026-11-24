/**
 * 羽章检查定时任务
 * @description 每天检查用户是否符合羽章条件，自动发放羽章
 * @usage node scripts/checkBadges.js
 * 
 * 检查项目：
 * 1. user.avatar_upload - 用户有头像（avatar 不为空）
 * 2. club.became_leader - 用户是社团领袖（role = 'leader'）
 * 3. club.anniversary - 用户在社团待满1年
 */

require('dotenv').config();
const db = require('../config/database');
const { checkAndAwardBadge } = require('../routes/badges');

const ANNIVERSARY_DAYS = 365;

/**
 * 检查头像羽章
 * @description 检查所有有头像但没有"形象塑造"羽章的用户
 */
async function checkAvatarBadge() {
  console.log('\n=== 检查头像羽章 ===');
  
  try {
    const users = await db('users')
      .select('id', 'nickname', 'avatar')
      .whereNotNull('avatar')
      .where('avatar', '!=', '')
      .whereNotExists(function() {
        this.select('*')
          .from('user_badges')
          .join('badges', 'user_badges.badge_id', 'badges.id')
          .whereRaw('user_badges.user_id = users.id')
          .where('badges.code', 'avatar_uploaded');
      });
    
    console.log(`找到 ${users.length} 个有头像但未获得羽章的用户`);
    
    let count = 0;
    for (const user of users) {
      try {
        await checkAndAwardBadge(user.id, 'user.avatar_upload');
        count++;
        console.log(`✓ 用户 ${user.id} (${user.nickname || '未命名'}) 获得形象塑造羽章`);
      } catch (error) {
        console.error(`✗ 用户 ${user.id} 发放失败:`, error.message);
      }
    }
    
    return count;
  } catch (error) {
    console.error('检查头像羽章失败:', error);
    return 0;
  }
}

/**
 * 检查社团领袖羽章
 * @description 检查所有是社团领袖但没有"社团领袖"羽章的用户
 */
async function checkClubLeaderBadge() {
  console.log('\n=== 检查社团领袖羽章 ===');
  
  try {
    const leaders = await db('club_members')
      .select('club_members.user_id', 'club_members.club_id', 'users.nickname')
      .join('users', 'club_members.user_id', 'users.id')
      .where('club_members.role', 'leader')
      .where('club_members.status', 'active')
      .whereNotExists(function() {
        this.select('*')
          .from('user_badges')
          .join('badges', 'user_badges.badge_id', 'badges.id')
          .whereRaw('user_badges.user_id = club_members.user_id')
          .where('badges.code', 'club_leader');
      });
    
    console.log(`找到 ${leaders.length} 个社团领袖但未获得羽章的用户`);
    
    let count = 0;
    for (const leader of leaders) {
      try {
        await checkAndAwardBadge(leader.user_id, 'club.became_leader');
        count++;
        console.log(`✓ 用户 ${leader.user_id} (${leader.nickname || '未命名'}) 获得社团领袖羽章`);
      } catch (error) {
        console.error(`✗ 用户 ${leader.user_id} 发放失败:`, error.message);
      }
    }
    
    return count;
  } catch (error) {
    console.error('检查社团领袖羽章失败:', error);
    return 0;
  }
}

/**
 * 检查社团周年羽章
 * @description 检查所有在社团待满1年但没有"社团之星"羽章的用户
 */
async function checkClubAnniversaryBadge() {
  console.log('\n=== 检查社团周年羽章 ===');
  
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - ANNIVERSARY_DAYS);
    
    const members = await db('club_members')
      .select('club_members.user_id', 'club_members.club_id', 'club_members.joined_at', 'users.nickname')
      .join('users', 'club_members.user_id', 'users.id')
      .where('club_members.status', 'active')
      .where('club_members.joined_at', '<=', oneYearAgo)
      .whereNotExists(function() {
        this.select('*')
          .from('user_badges')
          .join('badges', 'user_badges.badge_id', 'badges.id')
          .whereRaw('user_badges.user_id = club_members.user_id')
          .where('badges.code', 'club_anniversary');
      });
    
    console.log(`找到 ${members.length} 个待满1年但未获得羽章的成员`);
    
    let count = 0;
    for (const member of members) {
      try {
        await checkAndAwardBadge(member.user_id, 'club.anniversary');
        count++;
        const days = Math.floor((new Date() - new Date(member.joined_at)) / (1000 * 60 * 60 * 24));
        console.log(`✓ 用户 ${member.user_id} (${member.nickname || '未命名'}) 在社团待了 ${days} 天，获得社团之星羽章`);
      } catch (error) {
        console.error(`✗ 用户 ${member.user_id} 发放失败:`, error.message);
      }
    }
    
    return count;
  } catch (error) {
    console.error('检查社团周年羽章失败:', error);
    return 0;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('羽章检查定时任务开始');
  console.log(`执行时间: ${new Date().toISOString()}`);
  console.log('========================================');
  
  const results = {
    avatar: 0,
    leader: 0,
    anniversary: 0
  };
  
  try {
    results.avatar = await checkAvatarBadge();
    results.leader = await checkClubLeaderBadge();
    results.anniversary = await checkClubAnniversaryBadge();
    
    console.log('\n========================================');
    console.log('羽章检查完成');
    console.log(`头像羽章: ${results.avatar} 个`);
    console.log(`社团领袖羽章: ${results.leader} 个`);
    console.log(`社团周年羽章: ${results.anniversary} 个`);
    console.log(`总计: ${results.avatar + results.leader + results.anniversary} 个`);
    console.log('========================================');
    
    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error('羽章检查任务失败:', error);
    await db.destroy();
    process.exit(1);
  }
}

main();
