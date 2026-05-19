const getPythonApiUrl = () => (
  process.env.PYTHON_API_URL ||
  process.env.PYTHON_SERVICE_URL ||
  'http://localhost:8000'
).replace(/\/$/, '');

const getSummaryScoreTimeoutMs = () => {
  const timeout = Number(process.env.SUMMARY_SCORE_TIMEOUT_MS || 300000);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 300000;
};

const evaluateSummarizationScore = async ({ referenceContexts, response, coeff }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getSummaryScoreTimeoutMs());

  try {
    const payload = {
      referenceContexts,
      response,
    };
    if (coeff !== undefined && coeff !== null) {
      payload.coeff = coeff;
    }

    const res = await fetch(`${getPythonApiUrl()}/api/evaluation/summarization-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.detail || data?.message || `Summary evaluation failed with ${res.status}`);
    }
    if (typeof data?.score !== 'number' || typeof data?.passed !== 'boolean') {
      throw new Error('Summary evaluation response is missing score or passed');
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Summary evaluation timed out after ${getSummaryScoreTimeoutMs()}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  evaluateSummarizationScore,
};
