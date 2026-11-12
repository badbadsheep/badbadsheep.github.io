/**
 * Sätteri 的数学公式插件：把 mdast 的 math / inlineMath 节点换成 KaTeX 的 HTML。
 *
 * 为什么不用 remark-math + rehype-katex：
 *   Astro 7 默认的 Markdown 处理器是 Sätteri，remark/rehype 插件那套要额外装
 *   @astrojs/markdown-remark 并整体换掉处理器；换掉之后 smart punctuation 的
 *   行为会变（中文里的 "..." 会变成 ”...”，---> 会退回 --->），等于为了公式
 *   改掉全站排版。Sätteri 自己就能把 $...$ / $$...$$ 解析成 math 节点
 *   （features.math），这里只负责「渲染」这最后一步。
 *
 * 为什么输出 mdast 的 html 节点：mdast→hast 时 html 会变成 raw 节点，HTML 原样
 *   保留；公式里的换行、*、_ 都不会被当成 Markdown 重新解析。KaTeX 的
 *   output 是 htmlAndMathml，<math xmlns> 也能完整保留。
 */
import katex from 'katex';

function render(tex, displayMode) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
    });
  } catch (error) {
    // 公式写错不该让整站构建失败：退回 KaTeX 的红色错误输出，并在终端提醒。
    console.warn(`[math] 公式渲染失败（已按原文输出）：${error.message}\n${tex}`);
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
    });
  }
}

export const katexPlugin = {
  name: 'bbs:katex',
  math(node, ctx) {
    ctx.replaceNode(node, { type: 'html', value: render(node.value, true) });
  },
  inlineMath(node, ctx) {
    ctx.replaceNode(node, { type: 'html', value: render(node.value, false) });
  },
};
