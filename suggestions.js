const suggestionForm = document.getElementById('suggestion-form');

suggestionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = suggestionForm.querySelector('button[type="submit"]');
  const feedback = document.getElementById('suggestion-feedback');
  const formData = new FormData(suggestionForm);
  submitButton.disabled = true;
  feedback.textContent = 'Sending your suggestion...';

  try {
    const response = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    feedback.textContent = error.message || 'Could not send your suggestion. Please try again.';
  } finally {
    submitButton.disabled = false;
  }
});
