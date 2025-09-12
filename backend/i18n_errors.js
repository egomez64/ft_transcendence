const E = {
	INVALID_USER_ID: {status: 400, key: 'users.invalid_user_id'},
	INVALID_FRIEND_ID: { status: 400, key: 'friends.invalid_friend_id' },
	MISSING_FRIEND_PARAM: { status : 400, key: 'friends.missing_friend_param' },
	INVALID_HANDLE: { status: 400, key: 'friends.invalid_handle' },
	CANNOT_ADD_SELF: { status: 400, key: 'friends.cannot_add_self' },

	USER_NOT_FOUND: { status: 404, key: 'friends.user_not_found' },
	FRIEND_NOT_FOUND: { status: 404, key: 'friends.friend_not_found' },

	ALREADY_FRIENDS: { status: 409, key: 'friends.already' },
	NOT_FRIENDS: { status: 409, key: 'friends.not_friends' },

	UNAUTHORIZED: { status: 401, key: 'auth.must_login' },

	UNKNOWN : { status: 500, key: 'common.server_error' }
};

function replyError(reply, code, params = {}) {
	const e = E[code] || E.UNKNOWN;
	return reply.code(e.status).send({
		ok: false,
		code,
		error_key: e.key,
		params
	});
}

module.exports = { E, replyError };