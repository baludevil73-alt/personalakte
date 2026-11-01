export function canEdit(role) { return ['editor', 'admin'].includes(role); }
export function validateRecord(name, notes) {
  if (!name.trim() || name.trim().length > 160 || notes.length > 20000) throw new Error('Name: 1–160 Zeichen; Notizen: höchstens 20.000 Zeichen.');
  return {name: name.trim(), notes};
}
