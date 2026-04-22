(() => {
  'use strict';

  /* =========================================================
     Membership wizard (v12)
     4 steps · inline validation · localStorage autosave ·
     summary review · mailto submit
     ========================================================= */

  const STORAGE_KEY = 'keiyukai-sociology-app-v1';
  const TOTAL_STEPS = 4;

  const form = document.getElementById('membership-form');
  const wizard = document.getElementById('wizard');
  const prevBtn = document.getElementById('wizard-prev');
  const nextBtn = document.getElementById('wizard-next');
  const submitBtn = document.getElementById('wizard-submit');
  const resetBtn = document.getElementById('wizard-reset');
  const progressFill = document.getElementById('progress-fill');
  const stepCounter = document.getElementById('step-counter');
  const saveIndicator = document.getElementById('save-indicator');
  const errorsEl = document.getElementById('m-errors');
  const summaryBody = document.getElementById('summary-body');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  if (!form || !wizard) return;

  const steps = Array.from(form.querySelectorAll('.m-step'));
  const indicators = Array.from(document.querySelectorAll('[data-step-indicator]'));
  let current = 1;

  /* ---------- Field labels for summary + errors ---------- */
  const LABELS = {
    name_kanji: 'お名前（漢字）',
    name_kana: 'フリガナ',
    student_id: '学籍番号',
    department: '在籍学部',
    email: 'メールアドレス',
    email_domain_ok: 'Gmail/keio.jp 確認',
    email_verified: '入力ミス確認',
    phone: '携帯電話番号',
    prefecture: '都道府県',
    age: '年齢層',
    occupation: '職業',
    'source[]': 'ご入会のきっかけ',
    referrer: 'ご紹介者',
    intro: '自己紹介',
    motivation: '入会動機',
    impression: 'サイトへのご感想',
    verification: '最終確認・卒論計画',
    rule_note: '独習ノート禁止ルール順守',
    rule_record: '録音・録画禁止',
    privacy: 'プライバシーポリシー同意',
  };

  /* ---------- Step / progress rendering ---------- */
  function renderStep(n, skipScroll) {
    current = Math.max(1, Math.min(TOTAL_STEPS, n));
    steps.forEach((s) => {
      s.classList.toggle('is-active', parseInt(s.dataset.step, 10) === current);
    });
    indicators.forEach((i) => {
      const step = parseInt(i.dataset.stepIndicator, 10);
      i.classList.toggle('is-active', step === current);
      i.classList.toggle('is-done', step < current);
    });
    if (progressFill) progressFill.style.width = (current / TOTAL_STEPS * 100) + '%';
    if (stepCounter) stepCounter.textContent = `Step ${current} / ${TOTAL_STEPS}`;

    prevBtn.disabled = current === 1;
    if (current === TOTAL_STEPS) {
      nextBtn.hidden = true;
      submitBtn.hidden = false;
      buildSummary();
    } else {
      nextBtn.hidden = false;
      submitBtn.hidden = true;
    }

    errorsEl.textContent = '';

    if (!skipScroll) {
      const top = wizard.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  /* ---------- Validation of the currently visible step ---------- */
  function collectStepFields(n) {
    const container = form.querySelector(`.m-step[data-step="${n}"]`);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input, textarea, select'));
  }

  function showFieldError(el, msg) {
    el.classList.add('has-error');
    // Find nearest .m-err
    const field = el.closest('.m-field, label');
    if (field) {
      const err = field.querySelector(':scope > .m-err, :scope .m-err');
      if (err) err.textContent = msg || '';
    }
  }
  function clearFieldError(el) {
    el.classList.remove('has-error');
    const field = el.closest('.m-field, label');
    if (field) {
      const err = field.querySelector(':scope > .m-err, :scope .m-err');
      if (err) err.textContent = '';
    }
  }

  function validateStep(n) {
    const fields = collectStepFields(n);
    // Reset previous errors
    fields.forEach(clearFieldError);
    errorsEl.textContent = '';

    const errors = [];
    const seen = new Set();

    fields.forEach((f) => {
      if (!f.required) return;
      if (f.type === 'radio') {
        const group = form.querySelectorAll(`input[type="radio"][name="${f.name}"]`);
        const picked = Array.from(group).some((r) => r.checked);
        if (!picked && !seen.has(f.name)) {
          errors.push(LABELS[f.name] || f.name);
          seen.add(f.name);
          showFieldError(f, '選択してください');
        }
        return;
      }
      if (f.type === 'checkbox') {
        if (!f.checked) {
          errors.push(LABELS[f.name] || f.name);
          showFieldError(f, '');
        }
        return;
      }
      const val = (f.value || '').trim();
      if (!val) {
        errors.push(LABELS[f.name] || f.name);
        showFieldError(f, '入力してください');
        return;
      }
      // Min-length check for textareas
      if (f.tagName === 'TEXTAREA' && f.minLength && val.length < f.minLength) {
        errors.push(`${LABELS[f.name] || f.name}（あと ${f.minLength - val.length} 文字）`);
        showFieldError(f, `あと ${f.minLength - val.length} 文字ほど具体的にお書きください`);
        return;
      }
      // Native HTML5 validation (email pattern etc.)
      if (!f.checkValidity()) {
        errors.push(`${LABELS[f.name] || f.name}（形式）`);
        showFieldError(f, '形式をご確認ください');
      }
    });

    // Step-3 source[] needs at least one checked
    if (n === 3) {
      const any = form.querySelectorAll('input[name="source[]"]:checked').length > 0;
      if (!any) {
        errors.push('ご入会のきっかけ');
        const first = form.querySelector('input[name="source[]"]');
        if (first) showFieldError(first, 'ひとつ以上お選びください');
      }
    }

    if (errors.length) {
      errorsEl.textContent = '以下の項目をご確認ください：' + errors.join(' ／ ');
    }
    return errors.length === 0;
  }

  /* ---------- Summary builder ---------- */
  function buildSummary() {
    if (!summaryBody) return;
    const fd = new FormData(form);
    const rows = [];

    const addRow = (key, val) => {
      rows.push({ key, val: val && String(val).trim() ? val : null });
    };

    addRow('お名前', (fd.get('name_kanji') || '') + (fd.get('name_kana') ? `（${fd.get('name_kana')}）` : ''));
    addRow('学籍番号', fd.get('student_id'));
    addRow('在籍学部', fd.get('department'));
    addRow('メールアドレス', fd.get('email'));
    addRow('携帯電話番号', fd.get('phone'));
    addRow('都道府県', fd.get('prefecture'));
    addRow('年齢層', fd.get('age'));
    addRow('職業', fd.get('occupation'));

    const sources = fd.getAll('source[]');
    addRow('ご入会のきっかけ', sources.length ? sources.join('、') : null);
    const ref = fd.get('referrer');
    if (ref) addRow('ご紹介者', ref);

    addRow('自己紹介', fd.get('intro'));
    addRow('入会動機', fd.get('motivation'));
    addRow('サイトへのご感想', fd.get('impression'));

    summaryBody.innerHTML = '';
    rows.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'm-summary__row';
      const k = document.createElement('div');
      k.className = 'm-summary__key';
      k.textContent = r.key;
      const v = document.createElement('div');
      v.className = 'm-summary__val' + (r.val ? '' : ' is-empty');
      v.textContent = r.val || '未入力';
      row.appendChild(k);
      row.appendChild(v);
      summaryBody.appendChild(row);
    });
  }

  /* ---------- Autosave to localStorage ---------- */
  let saveTimeout = null;
  function saveState() {
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) {
      if (k.endsWith('[]')) {
        if (!data[k]) data[k] = [];
        data[k].push(v);
      } else {
        data[k] = v;
      }
    }
    // Also record checkboxes explicitly (FormData skips unchecked)
    form.querySelectorAll('input[type="checkbox"]').forEach((c) => {
      if (c.name.endsWith('[]')) return;
      data['__chk_' + c.name] = c.checked ? 1 : 0;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step: current, savedAt: Date.now() }));
      flashSaved();
    } catch (_) { /* quota / private mode — ignore */ }
  }

  function flashSaved() {
    if (!saveIndicator) return;
    saveIndicator.textContent = '自動保存しました';
    saveIndicator.classList.add('is-saved');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveIndicator.classList.remove('is-saved');
      saveIndicator.textContent = '';
    }, 1800);
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const { data, step } = JSON.parse(raw);
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith('__chk_')) {
          const name = k.slice('__chk_'.length);
          const el = form.querySelector(`input[type="checkbox"][name="${name}"]`);
          if (el) el.checked = !!v;
          return;
        }
        if (Array.isArray(v)) {
          v.forEach((val) => {
            const el = form.querySelector(`input[name="${k}"][value="${CSS.escape(val)}"]`);
            if (el) el.checked = true;
          });
          return;
        }
        const el = form.querySelector(`[name="${k}"]`);
        if (!el) return;
        if (el.type === 'radio') {
          const target = form.querySelector(`input[name="${k}"][value="${CSS.escape(v)}"]`);
          if (target) target.checked = true;
        } else {
          el.value = v;
        }
      });
      if (step && typeof step === 'number') renderStep(step, true);
      updateAllCounters();
    } catch (_) { /* ignore */ }
  }

  function clearState() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) { }
    form.reset();
    updateAllCounters();
    steps.forEach((s) => s.querySelectorAll('.has-error').forEach((e) => e.classList.remove('has-error')));
    renderStep(1);
  }

  /* ---------- Character counters ---------- */
  function updateCounter(textarea) {
    const counter = textarea.parentElement.querySelector(`.m-counter[data-for="${textarea.name}"]`);
    if (!counter) return;
    const len = textarea.value.length;
    const min = parseInt(textarea.getAttribute('minlength') || '0', 10);
    counter.textContent = len + ' 文字' + (min ? ` / 最低 ${min}` : '');
    counter.classList.toggle('is-ok', len >= min && min > 0);
  }
  function updateAllCounters() {
    form.querySelectorAll('textarea[minlength]').forEach(updateCounter);
  }
  form.querySelectorAll('textarea').forEach((ta) => {
    ta.addEventListener('input', () => updateCounter(ta));
  });

  /* ---------- Navigation handlers ---------- */
  nextBtn.addEventListener('click', () => {
    if (!validateStep(current)) return;
    renderStep(current + 1);
    saveState();
  });
  prevBtn.addEventListener('click', () => {
    renderStep(current - 1);
    saveState();
  });

  // Allow clicking an earlier step indicator to jump back (not forward)
  indicators.forEach((i) => {
    i.addEventListener('click', () => {
      const target = parseInt(i.dataset.stepIndicator, 10);
      if (target < current) {
        renderStep(target);
      }
    });
    i.style.cursor = 'pointer';
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('入力内容をすべて消去してよろしいですか？この操作は取り消せません。')) {
      clearState();
    }
  });

  // Autosave on any field change (debounced)
  let changeTimeout = null;
  form.addEventListener('input', () => {
    clearTimeout(changeTimeout);
    changeTimeout = setTimeout(saveState, 600);
  });
  form.addEventListener('change', saveState);

  /* ---------- Submit (mailto) ---------- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateStep(TOTAL_STEPS)) return;

    // Build the email body
    const fd = new FormData(form);
    const lines = [];
    lines.push('■ 慶友会 社会学ゼミ 入会申込');
    lines.push('（このメールは申込フォームから自動生成されています）');
    lines.push('');

    const add = (label, val) => { lines.push(`${label}: ${val || ''}`); };

    add('1. お名前（漢字）', fd.get('name_kanji'));
    add('   フリガナ', fd.get('name_kana'));
    add('2. 学籍番号', fd.get('student_id'));
    add('3. 在籍学部', fd.get('department'));
    add('4. メールアドレス', fd.get('email'));
    add('5. 携帯電話番号', fd.get('phone'));
    add('6. 都道府県', fd.get('prefecture'));
    add('7. 年齢層', fd.get('age'));
    add('8. 職業', fd.get('occupation'));

    lines.push('');
    lines.push('9. ご入会のきっかけ（複数選択可）:');
    fd.getAll('source[]').forEach((s) => lines.push(`   - ${s}`));
    const ref = fd.get('referrer');
    if (ref) lines.push(`   ご紹介者: ${ref}`);

    lines.push('');
    lines.push('10. 自己紹介:');
    lines.push(fd.get('intro') || '');

    lines.push('');
    lines.push('11. 入会を希望する動機:');
    lines.push(fd.get('motivation') || '');

    lines.push('');
    lines.push('12. サイトへのご感想:');
    lines.push(fd.get('impression') || '');

    lines.push('');
    lines.push('13. 誤記入の確認・卒論計画・現在のお悩み等:');
    lines.push(fd.get('verification') || '');

    lines.push('');
    lines.push('---');
    lines.push('【ルール順守への同意】');
    lines.push(`・独習ノートのスクリーンショット禁止ルール順守に同意: ${fd.get('rule_note') ? '✓' : '-'}`);
    lines.push(`・講師派遣の録音・撮影・録画を一切行わないことに同意:   ${fd.get('rule_record') ? '✓' : '-'}`);
    lines.push(`・プライバシーポリシーおよびゼミ規約に同意:             ${fd.get('privacy') ? '✓' : '-'}`);
    lines.push(`・Gmail / keio.jp アドレス使用を確認:                   ${fd.get('email_domain_ok') ? '✓' : '-'}`);
    lines.push(`・メールアドレスの入力ミスがないことを確認:             ${fd.get('email_verified') ? '✓' : '-'}`);

    const subject = `【入会申込】慶友会 社会学ゼミ - ${fd.get('name_kanji') || ''}`;
    const body = lines.join('\n');
    const mailto = 'mailto:sociology.semi.kk@gmail.com' +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    // Mark completed in storage so the form isn't stuck on reload
    saveState();
    window.location.href = mailto;
  });

  /* ---------- Scroll progress for this page ---------- */
  (function setupScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    let ticking = false;
    function update() {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      const ratio = total > 0 ? (h.scrollTop || window.scrollY) / total : 0;
      bar.style.width = (Math.max(0, Math.min(1, ratio)) * 100).toFixed(2) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    update();
  })();

  /* ---------- Init ---------- */
  restoreState();
  renderStep(current, true);
  updateAllCounters();
})();
