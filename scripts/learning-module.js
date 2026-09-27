/* Shared entrance behavior; module content supplies its own feedback. */
document.querySelectorAll('[data-module-entrance]').forEach(quiz => {
  const content = document.getElementById(quiz.dataset.content);
  const feedback = quiz.querySelector('.module-feedback');
  const enter = quiz.querySelector('.module-enter');
  const choices = [...quiz.querySelectorAll('.module-choice')];
  if (!content || !feedback || !enter) return;
  let unlocked = false;
  choices.forEach(button => button.addEventListener('click', () => {
    if (unlocked) return;
    choices.forEach(choice => choice.classList.remove('correct', 'wrong'));
    const correct = button.dataset.answer === 'correct';
    button.classList.add(correct ? 'correct' : 'wrong');
    feedback.innerHTML = quiz.querySelector(correct ? '[data-correct]' : '[data-incorrect]').innerHTML;
    if (correct) {
      unlocked = true;
      enter.hidden = false;
      choices.forEach(choice => { choice.disabled = true; });
    }
  }));
  enter.addEventListener('click', () => {
    if (!unlocked) return;
    content.hidden = false;
    const opening = content.querySelector('[data-module-opening]');
    if (opening) {
      opening.focus({preventScroll: true});
      opening.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
    }
    enter.hidden = true;
    feedback.innerHTML = '<strong>Module open.</strong> You can explore the lesson below.';
  });
});
