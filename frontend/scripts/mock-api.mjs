import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const owner = {
  id: "617ac74f-7dcc-4f3e-aac4-20c2c34db97d",
  name: "Александр",
  timeZone: "Europe/Moscow",
  weeklyAvailability: ["monday", "tuesday", "wednesday", "thursday", "friday"].map((dayOfWeek) => ({
    dayOfWeek,
    intervals: [{ startsAt: "09:00:00", endsAt: "18:00:00" }],
  })),
};

const eventTypes = [
  { id: "intro-call", title: "Знакомство", description: "Обсудим вашу задачу, ожидания и поймём, чем можем быть полезны друг другу.", durationMinutes: 30 },
  { id: "project-session", title: "Разбор проекта", description: "Сфокусированная встреча: разберём контекст, найдём узкие места и наметим следующие шаги.", durationMinutes: 60 },
  { id: "quick-question", title: "Быстрый вопрос", description: "Короткий созвон для одного конкретного вопроса, который проще обсудить голосом.", durationMinutes: 15 },
];

function futureTimestamp(daysAhead, hour) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return `${date.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00:00+03:00`;
}

const bookings = [{
  id: "04e0c006-850c-4278-97eb-9231c9b27db0",
  eventTypeId: "project-session",
  eventTypeTitle: "Разбор проекта",
  durationMinutes: 60,
  guest: { name: "Мария Соколова", email: "maria@example.com" },
  startsAt: futureTimestamp(1, 11),
  endsAt: futureTimestamp(1, 12),
  createdAt: new Date().toISOString(),
}];

function slotWindow(eventTypeId) {
  const eventType = eventTypes.find((item) => item.id === eventTypeId);
  const dates = Array.from({ length: 13 }, (_, index) => index + 1).filter((daysAhead) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysAhead);
    return ![0, 6].includes(date.getUTCDay());
  }).slice(0, 8);
  const hours = [9, 10, 11, 14, 15, 16];
  const slots = dates.flatMap((day) => hours.map((hour) => {
    const startsAt = futureTimestamp(day, hour);
    return {
      eventTypeId,
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + (eventType?.durationMinutes ?? 30) * 60_000).toISOString(),
    };
  })).filter((slot) => !bookings.some((booking) => booking.startsAt === slot.startsAt));
  const start = new Date();
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 13);
  return { startsOn: start.toISOString().slice(0, 10), endsOn: end.toISOString().slice(0, 10), ownerTimeZone: owner.timeZone, slots };
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response, status, body, location) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    ...(location ? { Location: location } : {}),
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    return response.end();
  }

  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method === "GET" && url.pathname === "/owner") return send(response, 200, owner);
  if (request.method === "GET" && url.pathname === "/owner/bookings") {
    return send(response, 200, [...bookings].sort((left, right) => left.startsAt.localeCompare(right.startsAt)));
  }
  if (request.method === "GET" && url.pathname === "/event-types") return send(response, 200, eventTypes);

  const slotsMatch = url.pathname.match(/^\/event-types\/([^/]+)\/slots$/);
  if (request.method === "GET" && slotsMatch) {
    const eventType = eventTypes.find((item) => item.id === slotsMatch[1]);
    return eventType
      ? send(response, 200, slotWindow(eventType.id))
      : send(response, 404, { code: "EVENT_TYPE_NOT_FOUND", message: "Формат встречи не найден." });
  }

  const eventMatch = url.pathname.match(/^\/event-types\/([^/]+)$/);
  if (request.method === "GET" && eventMatch) {
    const eventType = eventTypes.find((item) => item.id === eventMatch[1]);
    return eventType
      ? send(response, 200, eventType)
      : send(response, 404, { code: "EVENT_TYPE_NOT_FOUND", message: "Формат встречи не найден." });
  }

  if (request.method === "POST" && url.pathname === "/event-types") {
    const payload = await readJson(request);
    if (eventTypes.some((item) => item.id === payload.id)) {
      return send(response, 409, { code: "EVENT_TYPE_ID_EXISTS", message: "Идентификатор уже используется." });
    }
    eventTypes.push(payload);
    return send(response, 201, payload, `/event-types/${payload.id}`);
  }

  if (request.method === "POST" && url.pathname === "/bookings") {
    const payload = await readJson(request);
    const eventType = eventTypes.find((item) => item.id === payload.eventTypeId);
    if (!eventType) return send(response, 404, { code: "EVENT_TYPE_NOT_FOUND", message: "Формат встречи не найден." });
    if (bookings.some((item) => item.startsAt === payload.startsAt)) {
      return send(response, 409, { code: "SLOT_UNAVAILABLE", message: "Это время уже занято." });
    }
    const start = new Date(payload.startsAt);
    const booking = {
      id: randomUUID(),
      eventTypeId: eventType.id,
      eventTypeTitle: eventType.title,
      durationMinutes: eventType.durationMinutes,
      guest: payload.guest,
      startsAt: payload.startsAt,
      endsAt: new Date(start.getTime() + eventType.durationMinutes * 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    bookings.push(booking);
    return send(response, 201, booking, `/bookings/${booking.id}`);
  }

  return send(response, 404, { code: "INVALID_REQUEST", message: "Маршрут не найден." });
});

server.listen(8000, "127.0.0.1", () => {
  console.log("Mock API is available at http://127.0.0.1:8000");
});
