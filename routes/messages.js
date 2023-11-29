const GET_QUERY = 'SELECT * FROM messages WHERE id = ? AND thread_id = ?';
// newest first
const LIST_QUERY = 'SELECT * FROM messages WHERE thread_id = ? ORDER BY id DESC';
const INSERT_QUERY =
	'INSERT INTO messages (thread_id, role, content, metadata, file_ids) VALUES (?, ?, ?, ?, ?)';
const GET_LATEST_MESSAGE_QUERY =
	'SELECT * FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT 1';
const UPDATE_MESSAGE = 'UPDATE messages SET metadata = ? WHERE id = ? AND thread_id = ?';

const dbMessageToResponseMessage = dbMessage => {
	// convert the date to epoch seconds
	dbMessage.created_at = Math.floor(Date.parse(dbMessage.created_at) / 1000);
	// convert the id to a string
	dbMessage.id = dbMessage.id.toString();
	// convert the thread id to a string
	dbMessage.thread_id = dbMessage.thread_id ? dbMessage.thread_id.toString() : null;
	// convert run_id to a string
	dbMessage.run_id = dbMessage.run_id ? dbMessage.run_id.toString() : null;
	// convert assistant_id to a string
	dbMessage.assistant_id = dbMessage.assistant_id ? dbMessage.assistant_id.toString() : null;
	// if metadata exists, parse it. Else return empty object
	dbMessage.metadata = dbMessage.metadata ? JSON.parse(dbMessage.metadata) : {};
	// if files exists, parse it. Else return empty array
	dbMessage.file_ids = dbMessage.file_ids ? JSON.parse(dbMessage.file_ids) : [];
	dbMessage['object'] = 'thread.message';
	return dbMessage;
};

const dbMessageListToResponse = dbMessages => {
	const messages = dbMessages.map(dbMessageToResponseMessage);
	// get the first and last message ids
	const first_id = messages[messages.length - 1]?.id || null;
	const last_id = messages[0]?.id || null;
	const has_more = false;
	const object = 'list';
	return {
		object,
		data: messages,
		first_id,
		last_id,
		has_more,
	};
};

export const getMessagesHandler = async (request, env) => {
	const { params } = request;
	const { id, thread_id } = params;
	const db = await env.DB;
	const resp = await db.prepare(GET_QUERY).bind(id, thread_id).first();

	return Response.json(dbMessageToResponseMessage(resp));
};

export const listMessagesHandler = async (request, env) => {
	const { params } = request;
	const { thread_id } = params;
	const db = await env.DB;
	const resp = await db.prepare(LIST_QUERY).bind(thread_id).all();
	if (resp.success) {
		return Response.json(dbMessageListToResponse(resp.results));
	}

	return Response.json({ error: 'unable to get messages' }, { status: 500 });
};

export const createMessage = async (request, env) => {
	const { params } = request;
	const { thread_id } = params;
	const db = await env.DB;
	const data = await request.json();
	let { role, content, metadata, file_ids } = data;
	metadata = metadata ? JSON.stringify(metadata) : '{}';
	file_ids = file_ids ? JSON.stringify(file_ids) : '[]';
	const resp = await db
		.prepare(INSERT_QUERY)
		.bind(thread_id, role, content, metadata, file_ids)
		.run();
	if (resp.success) {
		const lastRow = await db.prepare(GET_LATEST_MESSAGE_QUERY).bind(thread_id).first();
		return Response.json(dbMessageToResponseMessage(lastRow), { status: 201 });
	}

	return Response.json({ error: 'unable to insert message' }, { status: 500 });
};

export const updateMessage = async (request, env) => {
	const { params } = request;
	const { id, thread_id } = params;
	const db = await env.DB;
	const data = await request.json();
	const { metadata } = data;
	const metadata_str = JSON.stringify(metadata);
	const resp = await db.prepare(UPDATE_MESSAGE).bind(metadata_str, id, thread_id).run();
	if (resp.success) {
		const updated = await db.prepare(GET_QUERY).bind(id, thread_id).first();
		return Response.json(dbMessageToResponseMessage(updated));
	}

	return Response.json({ error: 'unable to update message' }, { status: 500 });
};