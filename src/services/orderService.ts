import { Op } from "sequelize";
import { ServiceOrderRecord } from "../models";

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

function buildOrderId() {
  return `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDescription(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOrderPrice(value: string | number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;

  return Number.isFinite(parsed) ? Number(parsed) : 0;
}

function toServiceOrder(record: ServiceOrderRecord): ServiceOrder {
  const price = parseOrderPrice(record.price);

  return {
    id: record.id,
    requesterUserId: record.requesterUserId,
    professionalUserId: record.professionalUserId,
    requesterName: record.requesterName,
    professionalName: record.professionalName,
    category: record.category,
    description: record.description,
    date: record.orderDate.toISOString(),
    price,
    status: record.status,
    ...(typeof record.rating === "number" ? { rating: record.rating } : {})
  };
}

export async function listAllOrders() {
  const records = await ServiceOrderRecord.findAll({
    order: [["orderDate", "DESC"]]
  });
  return records.map(toServiceOrder);
}

export async function listOrdersForRequester(requesterUserId: number) {
  const records = await ServiceOrderRecord.findAll({
    where: { requesterUserId },
    order: [["orderDate", "DESC"]]
  });
  return records.map(toServiceOrder);
}

export async function listOrdersForProfessional(professionalUserId: number) {
  const records = await ServiceOrderRecord.findAll({
    where: { professionalUserId },
    order: [["orderDate", "DESC"]]
  });
  return records.map(toServiceOrder);
}

export async function getOrderById(orderId: string) {
  const record = await ServiceOrderRecord.findByPk(orderId);
  return record ? toServiceOrder(record) : null;
}

export async function getOrderForRequester(orderId: string, requesterUserId: number) {
  const record = await ServiceOrderRecord.findOne({
    where: {
      id: orderId,
      requesterUserId
    }
  });

  return record ? toServiceOrder(record) : null;
}

export async function getOrderForProfessional(orderId: string, professionalUserId: number) {
  const record = await ServiceOrderRecord.findOne({
    where: {
      id: orderId,
      professionalUserId
    }
  });

  return record ? toServiceOrder(record) : null;
}

export async function createServiceOrder(input: CreateServiceOrderInput) {
  const record = await ServiceOrderRecord.create({
    id: buildOrderId(),
    requesterUserId: input.requesterUserId,
    professionalUserId: input.professionalUserId,
    requesterName: input.requesterName,
    professionalName: input.professionalName,
    category: input.category,
    description: normalizeDescription(input.description),
    orderDate: input.date ? new Date(input.date) : new Date(),
    price: Number.isFinite(input.price) ? Number(input.price) : 0,
    status: "aguardando"
  });

  return toServiceOrder(record);
}

export async function updateOrderStatus(order: ServiceOrder, nextStatus: ServiceOrderStatus) {
  await ServiceOrderRecord.update(
    {
      status: nextStatus
    },
    {
      where: {
        id: order.id
      }
    }
  );

  return {
    ...order,
    status: nextStatus
  };
}

export async function setOrderRating(order: ServiceOrder, rating: number) {
  await ServiceOrderRecord.update(
    {
      rating
    },
    {
      where: {
        id: order.id
      }
    }
  );

  return {
    ...order,
    rating
  };
}

export async function hasPendingOrInProgressOrder(
  requesterUserId: number,
  professionalUserId: number
) {
  const total = await ServiceOrderRecord.count({
    where: {
      requesterUserId,
      professionalUserId,
      status: {
        [Op.in]: ["aguardando", "em andamento"]
      }
    }
  });

  return total > 0;
}

export async function canUsersChat(userAId: number, userBId: number) {
  const total = await ServiceOrderRecord.count({
    where: {
      status: {
        [Op.in]: ["em andamento", "concluido"]
      },
      [Op.or]: [
        {
          requesterUserId: userAId,
          professionalUserId: userBId
        },
        {
          requesterUserId: userBId,
          professionalUserId: userAId
        }
      ]
    }
  });

  return total > 0;
}
