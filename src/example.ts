import { parseDeck } from './deck.ts'
import type { BriefInput } from './deck.ts'

export const EXAMPLE_INPUT: BriefInput = {
  project: '订单台 2.0',
  period: '11 月 16 日到 11 月 20 日',
  notes: [
    '订单列表分页已合入主分支，可以按时间和订单状态筛选。',
    'QA 已在测试环境跑完筛选回归。',
    '周一记录：加了索引，导出超时工单已关闭。',
    '周四回归仍碰到偶发的导出超时，发生频率和影响范围还没有统计。',
    '周五计划发版。发版前要定是否先关导出入口，拍板人还没确认。',
    '发版前补看慢请求和任务排队日志，确认是不是同一个问题。',
    '如果决定暂关入口，前端要先补一条用户提示。',
  ].join('\n'),
}

export const EXAMPLE_RESPONSE = {
  slides: [
    {
      kind: 'summary',
      title: { text: '分页已合入，导出还要再查', sourceIds: ['S01', 'S03', 'S04'] },
      points: [
        { text: '订单列表分页已合入，筛选回归已跑完。', sourceIds: ['S01', 'S02'] },
        { text: '周一关闭了超时工单，周四回归仍有偶发超时。', sourceIds: ['S03', 'S04'], conflicting: true },
        { text: '周五发版前要定是否先关导出入口。', sourceIds: ['S05'] },
      ],
    },
    {
      kind: 'progress',
      title: { text: '分页已合入，筛选回归已跑完', sourceIds: ['S01', 'S02'] },
      points: [
        { text: '订单列表可按时间和订单状态筛选。', sourceIds: ['S01'] },
        { text: 'QA 已在测试环境跑完筛选回归。', sourceIds: ['S02'] },
      ],
    },
    {
      kind: 'risks',
      title: { text: '导出超时关单后又出现', sourceIds: ['S03', 'S04'], conflicting: true },
      points: [
        { field: 'issue', text: '周一关单，周四回归仍碰到偶发超时。', sourceIds: ['S03', 'S04'], conflicting: true },
        { field: 'impact', text: '发生频率和影响范围还没有统计。', sourceIds: ['S04'] },
        { field: 'next', text: '查慢请求和排队日志，确认是不是同一个问题。', sourceIds: ['S06'] },
      ],
    },
    {
      kind: 'decisions',
      title: { text: '周五发版前先定导出入口', sourceIds: ['S05'] },
      points: [
        { field: 'decision', text: '周五上线时，导出入口保留还是暂时关闭？', sourceIds: ['S05'] },
        { field: 'owner', text: null, sourceIds: ['S05'] },
        { field: 'deadline', text: '周五发版前', sourceIds: ['S05'] },
        { field: 'basis', text: '超时仍会复现。如果暂关，发布前要给用户加提示。', sourceIds: ['S04', 'S07'] },
      ],
    },
  ],
}

export function exampleDeck() {
  return parseDeck(JSON.stringify(EXAMPLE_RESPONSE), { ...EXAMPLE_INPUT }, 'example')
}
