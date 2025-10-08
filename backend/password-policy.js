function passwordPolicyErrors(password, {username, email }) {
	const errs = [];
	const pw = String(password || '');

	if (pw.length < 8) errs.push('password.min');
	if (pw.length > 72) errs.push('password.max');
	if (!/[a-z]/.test(pw)) errs.push('password.lower');
	if (!/[A-Z]/.test(pw)) errs.push('password.upper');
	if (!/\d/.test(pw)) errs.push('password.digit');
	if (!/[^A-Za-z0-9]/.test(pw)) errs.push('password.symbol');

	const uname = String(username || '').toLowerCase();
	const mail  = String(email || '').toLowerCase();
	const local = (mail.split('@')[0] || '').toLowerCase();
	const pwLower = pw.toLowerCase();

	if (uname && pwLower.includes(uname)) errs.push('password.no_username');
	if (mail  && pwLower.includes(mail))  errs.push('password.no_email');
	if (local && pwLower.includes(local)) errs.push('password.no_email_local');

	return errs;
}

module.exports = { passwordPolicyErrors };