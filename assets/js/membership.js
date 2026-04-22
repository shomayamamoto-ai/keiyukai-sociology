(() => {
  'use strict';

  const form = document.getElementById('membership-form');
  const errors = document.getElementById('m-errors');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  if (!form) return;

  const LABELS = {
    name_kanji: '1. お名前（漢字）',
    name_kana: '   お名前フリガナ',
    student_id: '2. 学籍番号',
    department: '3. 在籍学部',
    email: '4. メールアドレス',
    email_domain_ok: '   Gmail / keio.jp 確認',
    email_verified: '   入力ミス確認',
    phone: '5. 携帯電話番号',
    prefecture: '6. 都道府県',
    age: '7. 年齢層',
    occupation: '8. 職業',
    'source[]': '9. 入会のきっかけ',
    referrer: '   ご紹介者',
    intro: '10. 自己紹介',
    motivation: '11. 入会動機',
    impression: '12. サイトへのご感想',
    verification: '13. 誤記入の確認・卒論計画等',
    rule_note: '【同意】独習ノート禁止ルール順守',
    rule_record: '【同意】講義録音・録画禁止',
    privacy: '【同意】プライバシーポリシー／ゼミ規約',
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errors.textContent = '';

    if (!form.checkValidity()) {
      const missing = [];
      Array.from(form.elements).forEach((el) => {
        if (el.required && !el.checkValidity()) {
          const key = el.name.replace(/\[\]$/, '[]');
          const label = LABELS[key] || el.name;
          if (!missing.includes(label)) missing.push(label);
        }
      });
      errors.textContent =
        '以下の必須項目をご確認ください：\n' + missing.join(' ／ ');
      form.reportValidity();
      return;
    }

    const fd = new FormData(form);
    const lines = [];

    lines.push('■ 慶友会 社会学ゼミ 入会申込');
    lines.push('（このメールは申込フォームから自動生成されています）');
    lines.push('');

    const fields = [
      ['name_kanji', '1. お名前（漢字）'],
      ['name_kana', '   お名前フリガナ'],
      ['student_id', '2. 学籍番号'],
      ['department', '3. 在籍学部'],
      ['email', '4. メールアドレス'],
      ['phone', '5. 携帯電話番号'],
      ['prefecture', '6. お住まいの都道府県'],
      ['age', '7. 年齢層'],
      ['occupation', '8. 職業'],
    ];

    fields.forEach(([key, label]) => {
      lines.push(`${label}: ${fd.get(key) || ''}`);
    });

    lines.push('');
    lines.push('9. ご入会のきっかけ（複数選択可）:');
    const sources = fd.getAll('source[]');
    sources.forEach((s) => lines.push(`   - ${s}`));
    const referrer = fd.get('referrer');
    if (referrer) lines.push(`   ご紹介者: ${referrer}`);

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
    lines.push(`・独習ノートのスクリーンショット禁止ルール順守に同意:  ${fd.get('rule_note') ? '✓' : '-'}`);
    lines.push(`・講師派遣の録音・撮影・録画を一切行わないことに同意:  ${fd.get('rule_record') ? '✓' : '-'}`);
    lines.push(`・プライバシーポリシーおよびゼミ規約に同意:            ${fd.get('privacy') ? '✓' : '-'}`);
    lines.push(`・Gmail / keio.jp アドレス使用を確認:                  ${fd.get('email_domain_ok') ? '✓' : '-'}`);
    lines.push(`・メールアドレスの入力ミスがないことを確認:            ${fd.get('email_verified') ? '✓' : '-'}`);

    const subject = `【入会申込】慶友会 社会学ゼミ - ${fd.get('name_kanji') || ''}`;
    const body = lines.join('\n');

    const mailto =
      'mailto:sociology.semi.kk@gmail.com' +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);

    window.location.href = mailto;
  });
})();
