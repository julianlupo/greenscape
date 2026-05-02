-- Add slack_channel_id to proposals so we can update the original Slack message
-- after approve/reject (chat.update needs both channel + ts).
alter table proposals
  add column if not exists slack_channel_id text;
