module.exports = async function ask(ctx, params) {
  const question = params?.question ?? 'What is 2+2?';
  ctx.log.info('Asking LLM', { question });

  const answer = await ctx.llm.ask(question);

  ctx.log.info('Got answer', { answer: answer.substring(0, 100) });
  ctx.emit('feed', { type: 'info', title: `Asked: ${question}`, body: answer.substring(0, 200) });

  return { question, answer };
};
