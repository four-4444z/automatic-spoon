const suggestionForm = document.getElementById('suggestion-form');

suggestionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = suggestionForm.querySelector('button[type="submit"]');
  const feedback = document.getElementById('suggestion-feedback');
  const formData = new FormData(suggestionForm);
  submitButton.disabled = true;
  feedback.textContent = 'Sending your suggestion...';

  try {
    const apiUrl = (window.SYSTEM_CORE_API_URL || '').replace(/\/+$/, '');
    const response = await fetch(`${apiUrl}/api/suggestions`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        type: formData.get('type'),
        title: formData.get('title'),
        details: formData.get('details'),
        name: formData.get('name')
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not send your suggestion.');
    suggestionForm.reset();
    feedback.textContent = 'Thanks! Your suggestion was sent.';
  } catch (error) {
    feedback.textContent = error instanceof TypeError
      ? 'Could not connect to the suggestions service. Check your connection and try again.'
      : error.message || 'Could not send your suggestion. Please try again.';
  } finally {
    submitButton.disabled = false;
  }
});
