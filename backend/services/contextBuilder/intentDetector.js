/**
 * 意图识别模块
 * @description 负责识别用户消息的意图类型，提取兴趣关键词等
 */

const { INTENT_PATTERNS, INTEREST_KEYWORDS } = require('./constants');
const { normalizeMessage } = require('./utils');

/**
 * 从用户消息中提取兴趣关键词
 * @description 匹配用户提到的兴趣,返回匹配的关键词、分类及同义词扩展
 * @param {string} message - 用户消息
 * @returns {Object} { keywords: string[], categories: string[], expandedKeywords: string[] }
 */
function extractInterestKeywords(message) {
  const lowerMessage = message.toLowerCase();
  const matchedKeywords = [];
  const matchedCategories = [];
  const expandedKeywords = new Set();

  for (const [category, keywords] of Object.entries(INTEREST_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        if (!matchedCategories.includes(category)) {
          matchedCategories.push(category);
        }
        keywords.forEach(k => expandedKeywords.add(k));
      }
    }
  }

  return {
    keywords: [...new Set(matchedKeywords)],
    categories: matchedCategories,
    expandedKeywords: [...expandedKeywords]
  };
}

/**
 * 识别用户意图
 * @description 支持多意图识别和优先级排序
 * @param {string} message - 用户消息
 * @returns {string} 意图类型
 */
function detectIntent(message) {
  const normalizedMessage = normalizeMessage(message);
  const lowerMessage = normalizedMessage.toLowerCase();
  const matchedIntents = [];

  for (const [intent, keywords] of Object.entries(INTENT_PATTERNS)) {
    const matchCount = keywords.filter(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    ).length;
    
    if (matchCount > 0) {
      matchedIntents.push({ intent, matchCount });
    }
  }

  if (matchedIntents.length === 0) {
    return 'general';
  }

  const hasEventKeyword = lowerMessage.includes('活动');
  const hasClubKeyword = lowerMessage.includes('社团');
  
  if (hasEventKeyword && !hasClubKeyword) {
    const hasEventIntent = matchedIntents.some(m => 
      m.intent === 'event_recommend' || m.intent === 'nearby_event'
    );
    if (!hasEventIntent) {
      matchedIntents.push({ intent: 'event_recommend', matchCount: 1 });
    }
    const eventPriorityOrder = ['nearby_event', 'event_recommend', 'club_info', 'recruitment_info', 'club_recommend', 'help', 'general'];
    for (const priority of eventPriorityOrder) {
      if (matchedIntents.some(m => m.intent === priority)) {
        return priority;
      }
    }
  } else if (hasClubKeyword && !hasEventKeyword) {
    const clubPriorityOrder = ['club_info', 'recruitment_info', 'club_recommend', 'nearby_event', 'event_recommend', 'help', 'general'];
    for (const priority of clubPriorityOrder) {
      if (matchedIntents.some(m => m.intent === priority)) {
        return priority;
      }
    }
  } else if (hasEventKeyword && hasClubKeyword) {
    matchedIntents.sort((a, b) => b.matchCount - a.matchCount);
    const eventMatch = matchedIntents.find(m => m.intent === 'event_recommend' || m.intent === 'nearby_event');
    const clubMatch = matchedIntents.find(m => m.intent === 'club_recommend' || m.intent === 'club_info');
    if (eventMatch && clubMatch && eventMatch.matchCount >= clubMatch.matchCount) {
      return eventMatch.intent;
    }
    if (clubMatch) return clubMatch.intent;
    if (eventMatch) return eventMatch.intent;
  }

  matchedIntents.sort((a, b) => b.matchCount - a.matchCount);
  const priorityOrder = ['club_info', 'recruitment_info', 'nearby_event', 'event_recommend', 'club_recommend', 'help', 'general'];
  
  for (const priority of priorityOrder) {
    if (matchedIntents.some(m => m.intent === priority)) {
      return priority;
    }
  }

  return matchedIntents[0].intent;
}

/**
 * 从消息中提取社团名称
 * @param {string} message - 用户消息
 * @returns {string|null} 社团名称或null
 */
function extractClubName(message) {
  const suffixes = ['社团', '协会', '俱乐部', '队伍', '队', '中心', '团', '社', '部'];
  for (const suffix of suffixes) {
    const idx = message.indexOf(suffix);
    if (idx !== -1) {
      const start = Math.max(0, idx - 10);
      return message.substring(start, idx + suffix.length).trim();
    }
  }
  return null;
}

module.exports = {
  extractInterestKeywords,
  detectIntent,
  extractClubName
};
