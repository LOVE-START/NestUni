/**
 * 数据格式化模块
 * @description 负责将检索到的数据格式化为AI可理解的上下文文本
 */

const { BADGE_TYPE_NAMES, BADGE_RARITY_NAMES, APPLICATION_STATUS_TEXT, ACTIVITY_LEVELS } = require('./constants');
const { formatDistance } = require('./utils');
const { extractInterestKeywords } = require('./intentDetector');

/**
 * 构建完整的AI请求上下文
 * @param {string} intent - 意图类型
 * @param {Object} contextData - 检索到的上下文数据
 * @param {Object} userProfile - 用户画像
 * @param {string} message - 用户消息（用于提取兴趣关键词）
 * @returns {string} 组装好的上下文描述
 */
function buildContextMessage(intent, contextData, userProfile, message = '') {
  const profileStr = userProfile
    ? `用户昵称：${userProfile.nickname || '未知'}，已加入${userProfile.joinedClubs.length}个社团（${userProfile.joinedClubs.map(c => c.name).join('、')}），参加过${userProfile.totalEvents}个活动，活跃度${userProfile.activityScore}分。`
    : '用户信息未知。';

  let dataStr = '';

  switch (intent) {
    case 'club_recommend':
      const interestInfo = extractInterestKeywords(message);
      dataStr = formatClubRecommendData(contextData, interestInfo);
      break;
    case 'club_info':
      dataStr = formatClubInfoData(contextData);
      break;
    case 'event_recommend':
      dataStr = formatEventRecommendData(contextData);
      break;
    case 'nearby_event':
      dataStr = formatNearbyEventData(contextData);
      break;
    case 'recruitment_info':
      dataStr = formatRecruitmentData(contextData);
      break;
    case 'help':
      dataStr = formatHelpData(contextData);
      break;
    case 'badge_info':
      dataStr = formatBadgeInfoData(contextData);
      break;
    case 'badge_recommend':
      dataStr = formatBadgeRecommendData(contextData);
      break;
    case 'activity_info':
      dataStr = formatActivityInfoData(contextData);
      break;
    default:
      dataStr = formatGeneralData(contextData);
  }

  return `【用户画像】${profileStr}\n\n【当前数据库信息】\n${dataStr}`;
}

/**
 * 格式化社团推荐数据
 * @description 让AI理解用户兴趣并推荐相关社团
 * @param {Object} data - 社团推荐数据
 * @param {Object} interestInfo - 兴趣关键词信息 { keywords: [], categories: [] }
 * @returns {string} 格式化后的文本
 */
function formatClubRecommendData(data, interestInfo = { keywords: [], categories: [], expandedKeywords: [] }) {
  if (!data.clubs || data.clubs.length === 0) return '暂无社团数据';

  const lines = [];

  if (data.userMessage) {
    lines.push(`【用户消息】"${data.userMessage}"`);
  }

  if (data.interestKeywords && data.interestKeywords.length > 0) {
    lines.push(`【识别到的兴趣关键词】${data.interestKeywords.join('、')}`);
    lines.push(`【兴趣分类】${data.interestCategories.join('、')}`);
    if (data.expandedKeywords && data.expandedKeywords.length > 0) {
      lines.push(`【同义词扩展】系统已自动扩展搜索:${data.expandedKeywords.join('、')}\n`);
    }
  } else {
    lines.push(`【提示】未匹配到预设关键词,请AI根据用户消息理解用户兴趣\n`);
  }

  if (data.hasInterestMatch && data.matchedCount === 0) {
    lines.push(`【重要提示】数据库中没有与用户兴趣相关的社团!`);
    lines.push(`用户感兴趣的分类:${data.interestCategories.join('、')}`);
    lines.push(`\n请直接告知用户:"宝宝,暂时没有找到与你兴趣相关的社团哦~"`);
    lines.push(`不要编造任何社团推荐,可以建议用户查看其他分类的社团。`);
    lines.push(`\n系统共有${data.totalClubs}个社团,分类统计:`);
    for (const [cat, count] of Object.entries(data.categoryCount)) {
      lines.push(`- ${cat}:${count}个`);
    }
    return lines.join('\n');
  }

  if (data.hasInterestMatch) {
    if (data.hasExactMatch) {
      lines.push(`【匹配结果】找到${data.exactMatchCount}个与你兴趣完全匹配的社团:`);
    } else {
      lines.push(`【重要提示】没有找到与你兴趣完全匹配的社团!`);
      lines.push(`用户兴趣:${data.interestKeywords.join('、')}`);
      lines.push(`\n【推荐策略】请按以下顺序回答:`);
      lines.push(`1. 首先诚实告知:"宝宝,暂时没有找到与你兴趣完全匹配的社团哦~"`);
      lines.push(`2. 然后说明:"不过,我找到了一些同属【艺术】类的社团,也许你会感兴趣:"`);
      lines.push(`3. 推荐以下同分类社团,但不要编造理由(如"虽然主要学舞蹈,但也会运用绘画元素")`);
      lines.push(`4. 直接介绍社团本身的特点即可\n`);
      lines.push(`【同分类社团】共${data.sameCategoryCount}个同属艺术类的社团:`);
    }
  } else {
    lines.push(`【AI推荐任务】`);
    lines.push(`请根据用户消息"${data.userMessage}",理解用户的兴趣和需求。`);
    lines.push(`从以下所有社团中,推荐最符合用户兴趣的社团。`);
    lines.push(`如果找不到完全匹配的社团,可以推荐同分类或相关的社团。`);
    lines.push(`\n系统共有${data.totalClubs}个社团,分类统计:`);
    for (const [cat, count] of Object.entries(data.categoryCount)) {
      lines.push(`- ${cat}:${count}个`);
    }
    lines.push('\n所有社团列表:');
  }

  data.clubs.forEach(c => {
    lines.push(`- ${c.name}(${c.level},${c.category})${c.isJoined ? '【已加入】' : '【未加入】'}:${c.shortIntro || '暂无简介'}`);
    if (c.leaders && c.leaders.length > 0) {
      const leaderInfo = c.leaders.map(l => {
        if (l.wechat) {
          return `${l.nickname}（微信：${l.wechat}）`;
        }
        return l.nickname;
      }).join('、');
      lines.push(`  社长：${leaderInfo}`);
    }
  });

  if (data.hasInterestMatch && data.matchedCount > 0) {
    if (data.hasExactMatch) {
      lines.push('\n【推荐提示】请根据用户兴趣,推荐上述完全匹配的社团。');
    } else {
      lines.push('\n【推荐提示】请先告知没有完全匹配的社团,再推荐同分类社团。');
      lines.push('不要编造理由,直接介绍社团本身的特点即可。');
    }
  } else if (!data.hasInterestMatch) {
    lines.push('\n【推荐提示】请根据用户消息理解用户兴趣,推荐最相关的社团。');
    lines.push('如果找不到完全匹配的社团,可以推荐同分类或相关的社团。');
    lines.push('不要编造理由,直接介绍社团本身的特点即可。');
  }

  lines.push('\n【重要提示】');
  lines.push('1. 只展示上述列表中提供的社长联系方式，如果社长没有微信号，就不要编造任何联系方式！');
  lines.push('2. 如果用户询问联系方式，但列表中没有，请诚实告知："暂无社长联系方式信息"');
  lines.push('3. 严禁编造任何电话号码、微信号等联系方式！');

  return lines.join('\n');
}

/**
 * 格式化社团详情数据
 * @param {Object} data - 社团详情数据
 * @returns {string} 格式化后的文本
 */
function formatClubInfoData(data) {
  if (!data.clubs || data.clubs.length === 0) return '未找到匹配的社团';

  const results = data.clubs.map(c => {
    const lines = [`社团：${c.name}`];
    lines.push(`级别：${c.level}，分类：${c.category}`);
    lines.push(`简介：${c.shortIntro || '暂无'}`);
    lines.push(`详细介绍：${c.description || '暂无'}`);
    lines.push(`成员数：${c.memberCount}人`);
    if (c.leaders.length > 0) {
      const leaderInfo = c.leaders.map(l => {
        if (l.wechat) {
          return `${l.nickname}（微信：${l.wechat}）`;
        }
        return l.nickname;
      }).join('、');
      lines.push(`社长信息：${leaderInfo}`);
    }
    if (c.gallery.length > 0) {
      lines.push(`社团照片：${c.gallery.join('、')}`);
    }
    lines.push(`Logo：${c.logo || '暂无'}`);
    lines.push(`封面：${c.coverImage || '暂无'}`);
    return lines.join('\n');
  });

  const finalLines = [...results];
  finalLines.push('\n【重要提示】');
  finalLines.push('1. 只展示上述列表中提供的社长联系方式，如果社长没有微信号，就不要编造任何联系方式！');
  finalLines.push('2. 如果用户询问联系方式，但列表中没有，请诚实告知："暂无社长联系方式信息"');
  finalLines.push('3. 严禁编造任何电话号码、微信号等联系方式！');

  return finalLines.join('\n\n');
}

/**
 * 格式化活动推荐数据
 * @description 格式化活动数据供AI理解，强调数据来源约束，包含用户参与状态
 * @param {Object} data - 活动推荐数据
 * @returns {string} 格式化后的文本
 */
function formatEventRecommendData(data) {
  if (!data.events || data.events.length === 0) {
    const lines = [];
    lines.push('【重要提示】数据库中暂无即将举行的活动!');
    lines.push('\n请直接告知用户:"宝宝,暂时没有即将举行的活动哦~"');
    lines.push('不要编造任何活动信息,可以建议用户稍后再来查看,或者关注社团动态。');
    return lines.join('\n');
  }

  const lines = [];
  
  if (data.userMessage) {
    lines.push(`【用户消息】"${data.userMessage}"`);
  }

  if (data.interestKeywords && data.interestKeywords.length > 0) {
    lines.push(`【识别到的兴趣关键词】${data.interestKeywords.join('、')}`);
    if (data.expandedKeywords && data.expandedKeywords.length > 0) {
      lines.push(`【同义词扩展】系统已自动扩展搜索:${data.expandedKeywords.join('、')}`);
    }
    lines.push(`【匹配结果】找到${data.totalUpcoming}个与你兴趣相关的活动:\n`);
  } else {
    lines.push(`【数据来源】以下活动信息均来自数据库,严禁编造任何活动`);
    lines.push(`共有${data.totalUpcoming}个即将举行的活动:\n`);
  }

  const joinedEvents = data.events.filter(e => e.isJoined);
  const notJoinedEvents = data.events.filter(e => !e.isJoined);

  if (joinedEvents.length > 0) {
    lines.push(`【用户已参与的活动】共${joinedEvents.length}个:`);
    joinedEvents.forEach(e => {
      lines.push(`- ${e.title}(${e.date} ${e.time || ''},${e.location})【已报名】`);
      lines.push(`  分类:${e.category || '未分类'},主办方:${e.organizer || '未知'}`);
      if (e.contact) lines.push(`  联系方式:${e.contact}`);
    });
  }

  if (notJoinedEvents.length > 0) {
    lines.push(`\n【用户未参与的活动】共${notJoinedEvents.length}个:`);
    notJoinedEvents.forEach(e => {
      lines.push(`- ${e.title}(${e.date} ${e.time || ''},${e.location})`);
      lines.push(`  分类:${e.category || '未分类'},主办方:${e.organizer || '未知'}`);
      if (e.contact) lines.push(`  联系方式:${e.contact}`);
      if (e.tags.length > 0) lines.push(`  标签:${e.tags.join('、')}`);
      if (e.maxParticipants) lines.push(`  人数:${e.currentParticipants}/${e.maxParticipants}`);
      if (e.relatedClubs.length > 0) lines.push(`  关联社团:${e.relatedClubs.join('、')}`);
      if (e.registrationDeadline) lines.push(`  报名截止:${e.registrationDeadline}`);
      if (e.description) lines.push(`  描述:${e.description}`);
    });
  }

  lines.push('\n【推荐提示】请根据用户需求推荐上述活动,不要编造任何活动信息。');
  if (joinedEvents.length > 0) {
    lines.push(`用户已参与${joinedEvents.length}个活动,如果用户询问是否参与了某活动,请根据【用户已参与的活动】列表回答。`);
  }
  return lines.join('\n');
}

/**
 * 格式化附近活动数据
 * @description 包含用户参与状态
 * @param {Object} data - 附近活动数据
 * @returns {string} 格式化后的文本
 */
function formatNearbyEventData(data) {
  if (data.note) return data.note;
  if (!data.nearbyEvents || data.nearbyEvents.length === 0) return '附近暂无活动';

  const lines = [`用户位置：${data.userLocation.latitude}, ${data.userLocation.longitude}`];

  const joinedEvents = data.nearbyEvents.filter(e => e.isJoined);
  const notJoinedEvents = data.nearbyEvents.filter(e => !e.isJoined);

  if (joinedEvents.length > 0) {
    lines.push(`\n【用户已参与的附近活动】共${joinedEvents.length}个：`);
    joinedEvents.forEach(e => {
      lines.push(`- ${e.title}（${e.date} ${e.time || ''}，${e.location}，距离${formatDistance(e.distance)}）【已报名】`);
      if (e.organizer) lines.push(`  主办方：${e.organizer}`);
    });
  }

  if (notJoinedEvents.length > 0) {
    lines.push(`\n【用户未参与的附近活动】共${notJoinedEvents.length}个（按距离排序）：`);
    notJoinedEvents.forEach(e => {
      lines.push(`- ${e.title}（${e.date} ${e.time || ''}，${e.location}，距离${formatDistance(e.distance)}）`);
      if (e.organizer) lines.push(`  主办方：${e.organizer}`);
      if (e.contact) lines.push(`  联系方式：${e.contact}`);
    });
  }

  if (joinedEvents.length > 0) {
    lines.push(`\n用户已参与${joinedEvents.length}个附近活动。`);
  }
  return lines.join('\n');
}

/**
 * 格式化招新数据
 * @description 包含用户报名状态和社团卡片信息
 * @param {Object} data - 招新数据
 * @returns {string} 格式化后的文本
 */
function formatRecruitmentData(data) {
  if (!data.recruitments || data.recruitments.length === 0) {
    const lines = [];
    lines.push('【重要提示】当前没有正在进行的招新！');
    lines.push('\n请直接告知用户："宝宝，暂时没有正在招新的社团哦~"');
    lines.push('可以建议用户稍后再来查看，或者关注社团动态。');
    return lines.join('\n');
  }

  const lines = [];
  lines.push(`【数据来源】以下招新信息均来自数据库，严禁编造任何招新信息`);
  lines.push(`共有${data.totalRecruitments}个正在招新的社团：`);

  const appliedRecruitments = data.recruitments.filter(r => r.isApplied);
  const notAppliedRecruitments = data.recruitments.filter(r => !r.isApplied);

  if (appliedRecruitments.length > 0) {
    lines.push(`\n【用户已报名的招新】共${appliedRecruitments.length}个：`);
    appliedRecruitments.forEach(r => {
      const statusText = APPLICATION_STATUS_TEXT[r.applicationStatus] || '已报名';
      lines.push(`- ${r.club.name}（${r.club.level}，${r.club.category}）【${statusText}】`);
      lines.push(`  招新标题：${r.title}`);
      lines.push(`  社团简介：${r.club.shortIntro || '暂无'}`);
      if (r.endTime) lines.push(`  截止时间：${r.endTime}`);
      if (r.contactInfo) lines.push(`  联系方式：${r.contactInfo}`);
    });
  }

  if (notAppliedRecruitments.length > 0) {
    lines.push(`\n【用户未报名的招新】共${notAppliedRecruitments.length}个：`);
    notAppliedRecruitments.forEach(r => {
      lines.push(`- ${r.club.name}（${r.club.level}，${r.club.category}）${r.club.isJoined ? '【已加入该社团】' : ''}`);
      lines.push(`  招新标题：${r.title}`);
      lines.push(`  社团简介：${r.club.shortIntro || '暂无'}`);
      lines.push(`  招新描述：${r.description || '暂无'}`);
      if (r.requirements.length > 0) lines.push(`  招新要求：${r.requirements.join('、')}`);
      if (r.contactInfo) lines.push(`  联系方式：${r.contactInfo}`);
      if (r.endTime) lines.push(`  截止时间：${r.endTime}`);
      if (r.maxApplicants) lines.push(`  招募人数：${r.currentApplicants}/${r.maxApplicants}`);
    });
  }

  lines.push('\n【推荐提示】请根据用户需求推荐上述招新信息，不要编造任何招新信息。');
  if (appliedRecruitments.length > 0) {
    lines.push(`用户已报名${appliedRecruitments.length}个招新，如果用户询问是否报名了某招新，请根据【用户已报名的招新】列表回答。`);
  }
  return lines.join('\n');
}

/**
 * 格式化通用数据
 * @param {Object} data - 通用数据
 * @returns {string} 格式化后的文本
 */
function formatGeneralData(data) {
  const lines = [];
  if (data.stats) {
    lines.push(`系统概况：共${data.stats.totalClubs}个社团，${data.stats.activeEvents}个活动进行中，${data.stats.activeRecruitments}个招新进行中`);
  }
  if (data.categories) {
    lines.push('社团分类统计：');
    data.categories.forEach(c => {
      lines.push(`- ${c.name}：${c.count}个`);
    });
  }
  if (data.clubs && data.clubs.length > 0) {
    lines.push('\n所有社团列表：');
    data.clubs.forEach(c => {
      lines.push(`- ${c.name}（${c.level}，${c.category}）${c.isJoined ? '【已加入】' : ''}：${c.shortIntro || '暂无简介'}`);
    });
  }
  return lines.join('\n') || '暂无数据';
}

/**
 * 格式化帮助数据
 * @param {Object} data - 帮助数据
 * @returns {string} 格式化后的文本
 */
function formatHelpData(data) {
  const lines = ['小苑可以帮助你：'];
  data.features.forEach(f => {
    lines.push(`\n【${f.name}】${f.desc}`);
    lines.push(`  试试说：${f.examples.join('、')}`);
  });
  lines.push('\n\n请用亲切的语气向用户介绍这些功能，并引导用户尝试。');
  return lines.join('\n');
}

/**
 * 格式化羽章信息数据
 * @description 展示用户已获得的羽章、统计数据、未获得的羽章
 * @param {Object} data - 羽章信息数据
 * @returns {string} 格式化后的文本
 */
function formatBadgeInfoData(data) {
  const lines = [];
  
  lines.push(`【活跃度信息】当前活跃度${data.activityScore}分`);
  
  lines.push(`\n【羽章统计】`);
  lines.push(`总数：${data.stats.total}个羽章，总积分：${data.stats.totalPoints}分`);
  lines.push(`按类型：成就${data.stats.byType.achievement}个，等级${data.stats.byType.level}个，身份${data.stats.byType.identity}个`);
  lines.push(`按稀有度：传说${data.stats.byRarity.legendary}个，史诗${data.stats.byRarity.epic}个，稀有${data.stats.byRarity.rare}个，普通${data.stats.byRarity.common}个`);
  
  if (data.userBadges.length === 0) {
    lines.push(`\n【已获得的羽章】暂无羽章`);
  } else {
    lines.push(`\n【已获得的羽章】共${data.userBadges.length}个：`);
    
    const rarityOrder = ['legendary', 'epic', 'rare', 'common'];
    
    rarityOrder.forEach(rarity => {
      const badges = data.userBadges.filter(b => b.rarity === rarity);
      if (badges.length > 0) {
        lines.push(`\n${BADGE_RARITY_NAMES[rarity]}羽章：`);
        badges.forEach(b => {
          lines.push(`- ${b.name}【${BADGE_TYPE_NAMES[b.type]}】(${b.points}分)`);
          lines.push(`  ${b.description || '暂无描述'}`);
          lines.push(`  获得时间：${b.earnedAt}`);
          if (b.isDisplayed) {
            lines.push(`  【正在展示】`);
          }
        });
      }
    });
  }
  
  if (data.unearnedBadges.length > 0) {
    lines.push(`\n【未获得的羽章】共${data.unearnedBadges.length}个，展示前5个：`);
    data.unearnedBadges.slice(0, 5).forEach(b => {
      lines.push(`- ${b.name}【${BADGE_TYPE_NAMES[b.type]}】【${BADGE_RARITY_NAMES[b.rarity]}】(${b.points}分)`);
    });
  }
  
  lines.push(`\n【回复提示】`);
  lines.push(`1. 用亲切的语气介绍用户的羽章情况`);
  lines.push(`2. 如果用户没有羽章，鼓励用户参与活动、加入社团来获得羽章`);
  lines.push(`3. 可以提示用户说"推荐羽章"来查看如何获得更多羽章`);
  
  return lines.join('\n');
}

/**
 * 格式化羽章推荐数据
 * @description 展示智能推荐的羽章、获取进度、建议
 * @param {Object} data - 羽章推荐数据
 * @returns {string} 格式化后的文本
 */
function formatBadgeRecommendData(data) {
  const lines = [];
  
  lines.push(`【用户当前状态】`);
  lines.push(`活跃度：${data.activityScore}分`);
  lines.push(`已获得羽章：${data.earnedBadges.length}个`);
  lines.push(`未获得羽章：${data.unearnedBadges.length}个`);
  
  if (data.recommendations.length === 0) {
    lines.push(`\n【推荐结果】暂无匹配的羽章推荐`);
    lines.push(`可能的原因：`);
    lines.push(`1. 你已经获得了所有符合条件的羽章`);
    lines.push(`2. 活跃度需要进一步提升才能解锁更多羽章`);
    lines.push(`\n建议：多参加活动、发表评论、加入社团来提升活跃度`);
  } else {
    lines.push(`\n【智能推荐羽章】根据你的活跃度和兴趣，推荐以下${data.recommendations.length}个羽章：`);
    
    data.recommendations.forEach((rec, index) => {
      lines.push(`\n${index + 1}. ${rec.badge.name}【${BADGE_TYPE_NAMES[rec.badge.type]}】【${BADGE_RARITY_NAMES[rec.badge.rarity]}】`);
      lines.push(`   积分：${rec.badge.points}分`);
      lines.push(`   描述：${rec.badge.description || '暂无描述'}`);
      lines.push(`   匹配度：${rec.matchScore}分`);
      
      if (rec.reasons.length > 0) {
        lines.push(`   推荐理由：${rec.reasons.join('；')}`);
      }
      
      if (rec.progress) {
        lines.push(`   当前进度：${rec.progress.current}/${rec.progress.target}（${rec.progress.percentage}%）`);
        if (rec.progress.percentage >= 80) {
          lines.push(`   【即将完成！加油！】`);
        }
      }
    });
  }
  
  lines.push(`\n【回复提示】`);
  lines.push(`1. 优先推荐匹配度高、进度接近完成的羽章`);
  lines.push(`2. 用鼓励的语气告诉用户如何获得这些羽章`);
  lines.push(`3. 如果有即将完成的羽章，特别提示用户加油`);
  lines.push(`4. 不要编造任何羽章信息，只推荐上述列表中的羽章`);
  
  return lines.join('\n');
}

/**
 * 格式化活跃度信息数据
 * @description 展示活跃度分数、等级、提升建议
 * @param {Object} data - 活跃度信息数据
 * @returns {string} 格式化后的文本
 */
function formatActivityInfoData(data) {
  const lines = [];
  
  const levelEmojis = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    diamond: '💎'
  };
  
  lines.push(`【活跃度信息】`);
  lines.push(`当前等级：${levelEmojis[data.level]} ${data.levelName}`);
  lines.push(`活跃度分数：${data.activityScore}分`);
  
  if (data.nextLevel) {
    lines.push(`下一等级：${levelEmojis[data.nextLevel]} ${data.nextLevelName}`);
    lines.push(`距离下一等级：还需${data.pointsToNext}分`);
  } else {
    lines.push(`【已达到最高等级！】`);
  }
  
  lines.push(`\n【最近30天活动统计】`);
  lines.push(`登录次数：${data.recentActivity.logins}次（每次+1分）`);
  lines.push(`参与活动：${data.recentActivity.events}个（每个+5分）`);
  lines.push(`发表评论：${data.recentActivity.comments}条（每条+2分）`);
  lines.push(`报名招新：${data.recentActivity.applications}次（每次+3分）`);
  
  if (data.suggestions.length > 0) {
    lines.push(`\n【提升建议】`);
    data.suggestions.forEach((s, index) => {
      const priorityEmojis = { high: '🔥', medium: '⭐', low: '💡' };
      lines.push(`${index + 1}. ${priorityEmojis[s.priority]} ${s.suggestion}`);
    });
  }
  
  lines.push(`\n【活跃度计算规则】`);
  lines.push(`活跃度分数 = 登录次数×1 + 参与活动数×5 + 评论数×2 + 报名次数×3`);
  lines.push(`分数范围：0-100分`);
  lines.push(`等级划分：青铜(0-30) → 白银(31-60) → 黄金(61-80) → 钻石(81-100)`);
  
  lines.push(`\n【回复提示】`);
  lines.push(`1. 用鼓励的语气介绍用户的活跃度情况`);
  lines.push(`2. 根据提升建议，引导用户多参与平台活动`);
  lines.push(`3. 如果即将升级，特别提示用户加油`);
  lines.push(`4. 告诉用户活跃度可以解锁更多羽章`);
  
  return lines.join('\n');
}

module.exports = {
  buildContextMessage,
  formatClubRecommendData,
  formatClubInfoData,
  formatEventRecommendData,
  formatNearbyEventData,
  formatRecruitmentData,
  formatGeneralData,
  formatHelpData,
  formatBadgeInfoData,
  formatBadgeRecommendData,
  formatActivityInfoData
};
