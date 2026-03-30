export type ServiceOrderStatus = "aguardando" | "em andamento" | "concluido" | "cancelado";

export type ServiceOrder = {
  id: string;
  requesterUserId: number;
  professionalUserId: number;
  requesterName: string;
  professionalName: string;
  category: string;
  description: string | null;
  date: string;
  price: number;
  status: ServiceOrderStatus;
  rating?: number;
};

type CreateServiceOrderInput = {
  requesterUserId: number;
  professionalUserId: number;
  requesterName: string;
  professionalName: string;
  category: string;
  description?: string | null;
  date?: string;
  price?: number;
};

const serviceOrders: ServiceOrder[] = [];

function buildOrderId() {
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDescription(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function matchesPair(order: ServiceOrder, userAId: number, userBId: number) {
  return (
    (order.requesterUserId === userAId && order.professionalUserId === userBId) ||
    (order.requesterUserId === userBId && order.professionalUserId === userAId)
  );
}

export function listAllOrders() {
  return [...serviceOrders];
}

export function listOrdersForRequester(requesterUserId: number) {
  return serviceOrders.filter((order) => order.requesterUserId === requesterUserId);
}

export function listOrdersForProfessional(professionalUserId: number) {
  return serviceOrders.filter((order) => order.professionalUserId === professionalUserId);
}

export function getOrderById(orderId: string) {
  return serviceOrders.find((order) => order.id === orderId) ?? null;
}

export function getOrderForRequester(orderId: string, requesterUserId: number) {
  return (
    serviceOrders.find(
      (order) => order.id === orderId && order.requesterUserId === requesterUserId
    ) ?? null
  );
}

export function getOrderForProfessional(orderId: string, professionalUserId: number) {
  return (
    serviceOrders.find(
      (order) => order.id === orderId && order.professionalUserId === professionalUserId
    ) ?? null
  );
}

export function createServiceOrder(input: CreateServiceOrderInput) {
  const order: ServiceOrder = {
    id: buildOrderId(),
    requesterUserId: input.requesterUserId,
    professionalUserId: input.professionalUserId,
    requesterName: input.requesterName,
    professionalName: input.professionalName,
    category: input.category,
    description: normalizeDescription(input.description),
    date: input.date ?? new Date().toISOString(),
    price: Number.isFinite(input.price) ? Number(input.price) : 0,
    status: "aguardando"
  };

  serviceOrders.unshift(order);
  return order;
}

export function updateOrderStatus(order: ServiceOrder, nextStatus: ServiceOrderStatus) {
  order.status = nextStatus;
  return order;
}

export function setOrderRating(order: ServiceOrder, rating: number) {
  order.rating = rating;
  return order;
}

export function hasPendingOrInProgressOrder(requesterUserId: number, professionalUserId: number) {
  return serviceOrders.some(
    (order) =>
      order.requesterUserId === requesterUserId &&
      order.professionalUserId === professionalUserId &&
      (order.status === "aguardando" || order.status === "em andamento")
  );
}

export function canUsersChat(userAId: number, userBId: number) {
  return serviceOrders.some(
    (order) =>
      matchesPair(order, userAId, userBId) &&
      (order.status === "em andamento" || order.status === "concluido")
  );
}
