// VOE Helper — Manual VOE search page logic.
//
// This page is the "no electronic match" workhorse: shortcut cards for each
// provider's public search surface (URLs verified live on 2026-10-23) and a
// GitHub-issue link that carries whatever context it can (extension version,
// retrieval timestamp, and the employer name the user types). The issue is
// created empty-handed on the repo side by a maintainer; nothing is pushed to
// the catalog automatically — the ground-rule landing bar applies to anything
// a maintainer later merges into verified_seeds.jsonl.
(() => {
  const REPO = 'Spuds0588/VOE-Helper';
  const reportBtn = document.getElementById('reportMatch');
  if (!reportBtn) return;

  reportBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    const name = (document.getElementById('foundName').value || '').trim();
    const params = new URLSearchParams();
    params.set('template', 'match-report.md');
    if (name) params.set('title', 'Match report: ' + name);
    const body = [
      '**Manual match found via the voe-search page.**',
      '',
      '- Employer name (as shown on provider page): ' + (name || '_(fill in)_'),
      '- Provider: _(Truework / The Work Number / Thomas & Company / Vault Verify / other)_',
      '- Employer code (verbatim): _',
      '- Source URL (the exact page you read it on): _',
      '- Date verified: ' + new Date().toISOString().slice(0, 10),
      '',
      'Reminder per ground rule #4: this code only enters `verified_seeds.jsonl`',
      'once it has been re-read verbatim from the cited page by a maintainer.',
    ].join('\n');
    params.set('body', body);
    window.open(`https://github.com/${REPO}/issues/new?${params.toString()}`, '_blank');
  });
})();
