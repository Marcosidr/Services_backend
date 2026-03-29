import { Conversation } from "../models";

function normalizeParticipants(userA: number, userB: number) {
  return userA < userB ? { user1: userA, user2: userB } : { user1: userB, user2: userA };
}

export async function findOrCreateConversation(userA: number, userB: number) {
  const { user1, user2 } = normalizeParticipants(userA, userB);

  const existingConversation = await Conversation.findOne({
    where: { user1, user2 }
  });
  if (existingConversation) return existingConversation;

  return Conversation.create({ user1, user2 });
}
