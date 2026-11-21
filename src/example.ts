import { parseDeck } from './deck.ts'
import type { BriefInput } from './deck.ts'

export const EXAMPLE_INPUT: BriefInput = {
  project: '订单台 2.0',
  period: '11 月 16 日 — 11 月 20 日',
  notes: [
    '订单列表分页已合入主分支，覆盖按时间、订单状态筛选。',
    '补齐了筛选条件回归用例，已由 QA 在测试环境跑完。',
    '压测时发现导出偶发超时，目前还没有定位原因。',
    '周五计划发版，请负责人决定是否先关闭导出入口。',
    '下一步补抓导出链路的日志，记录慢请求和任务排队情况。',
    '若决定暂关入口，发布前由前端补齐用户提示。',
  ].join('\n'),
}

const result = {
  slides: [
    {
      kind: 'summary',
      title: '订单列表已就绪，导出仍待决策',
      points: [
        { text: '订单列表分页已合入主分支，筛选回归已完成。', sourceIds: ['S01', 'S02'] },
        { text: '导出压测发现偶发超时，原因待定位。', sourceIds: ['S03'] },
        { text: '周五发版前需确认是否暂时关闭导出入口。', sourceIds: ['S04'] },
      ],
    },
    {
      kind: 'progress',
      title: '分页功能合入，筛选回归完成',
      points: [
        { text: '订单列表分页已合入主分支，支持按时间和订单状态筛选。', sourceIds: ['S01'] },
        { text: '筛选条件回归用例已补齐，QA 已在测试环境完成回归。', sourceIds: ['S02'] },
      ],
    },
    {
      kind: 'risks',
      title: '导出偶发超时，根因仍待定位',
      points: [
        { text: '压测中发现导出偶发超时，现有记录尚未给出原因。', sourceIds: ['S03'] },
        { text: '补抓导出日志，重点检查慢请求和任务排队情况。', sourceIds: ['S05'] },
      ],
    },
    {
      kind: 'decisions',
      title: '发版前确认是否暂关导出入口',
      points: [
        { text: '由负责人决定周五发版时是否保留导出入口。', sourceIds: ['S04'] },
        { text: '如决定暂关，前端在发布前补齐用户提示。', sourceIds: ['S06'] },
      ],
    },
  ],
}

export function exampleDeck() {
  return parseDeck(JSON.stringify(result), { ...EXAMPLE_INPUT }, 'example')
}
