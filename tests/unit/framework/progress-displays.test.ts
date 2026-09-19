import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloaderDisplay } from '@eolian/framework/downloader-display';
import { MessageProgressUpdater } from '@eolian/framework/message-progress-updater';

function createMessage() {
  return {
    edit: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function createSendable(message = createMessage()) {
  return {
    message,
    sendable: {
      sendable: true,
      send: vi.fn().mockResolvedValue(message),
      sendEmbed: vi.fn(),
      sendSelection: vi.fn(),
    },
  };
}

describe('MessageProgressUpdater', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });
  afterEach(() => vi.useRealTimers());

  it('requires a terminal message for ephemeral progress', () => {
    expect(
      () => new MessageProgressUpdater(createSendable().sendable as never, { ephemeral: true }),
    ).toThrow('Ephemeral progress updater must have a finished message!');
  });

  it('coalesces immediate updates into one send of the latest value', async () => {
    const { message, sendable } = createSendable();
    const updater = new MessageProgressUpdater(sendable as never, { refreshInterval: 500 });
    updater.init('starting');
    updater.update('too soon');
    await updater.done();

    expect(sendable.send).toHaveBeenCalledTimes(1);
    expect(sendable.send).toHaveBeenCalledWith('too soon', {
      ephemeral: undefined,
      editReply: true,
    });
    expect(message.delete).toHaveBeenCalledOnce();
    expect(message.edit).not.toHaveBeenCalled();
  });

  it('edits a non-ephemeral message after the refresh interval', async () => {
    const { message, sendable } = createSendable();
    const updater = new MessageProgressUpdater(sendable as never, { refreshInterval: 500 });
    updater.init('first');
    await vi.advanceTimersByTimeAsync(500);
    updater.update('second');
    await updater.done();

    expect(message.edit).toHaveBeenCalledWith('second');
  });

  it('resends ephemeral updates and finishes with the configured message', async () => {
    const { message, sendable } = createSendable();
    const updater = new MessageProgressUpdater(sendable as never, {
      refreshInterval: 100,
      ephemeral: true,
      finishedMessage: 'finished',
    });
    updater.init('first');
    await vi.advanceTimersByTimeAsync(100);
    updater.update('second');
    await updater.done();

    expect(sendable.send).toHaveBeenNthCalledWith(2, 'second', {
      ephemeral: true,
      editReply: true,
    });
    expect(sendable.send).toHaveBeenLastCalledWith('finished', {
      ephemeral: true,
      editReply: true,
    });
    expect(message.edit).not.toHaveBeenCalled();
  });

  it('ignores updates before initialization and after completion', async () => {
    const { sendable } = createSendable();
    const updater = new MessageProgressUpdater(sendable as never);
    updater.update('before');
    await updater.done();
    updater.update('after');
    expect(sendable.send).not.toHaveBeenCalled();
  });
});

describe('DownloaderDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });
  afterEach(() => vi.useRealTimers());

  it('renders rounded progress, throttles updates, and completes the message', async () => {
    const { message, sendable } = createSendable();
    const display = new DownloaderDisplay(sendable as never, 'Download', 8, 100);
    display.init();
    display.update(2);
    display.update(3);
    await display.done();

    expect(sendable.send).toHaveBeenCalledOnce();
    expect(sendable.send).toHaveBeenCalledWith('Download: 38%\n▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱', {
      ephemeral: false,
    });
    expect(message.edit).toHaveBeenCalledWith('Download: 100%');
  });

  it('uses an init total override and edits after the refresh interval', async () => {
    const { message, sendable } = createSendable();
    const display = new DownloaderDisplay(sendable as never, 'File', 1000, 100);
    display.init(4);
    display.update(1);
    await vi.advanceTimersByTimeAsync(100);
    display.update(2);
    await display.done();

    expect(message.edit).toHaveBeenNthCalledWith(1, 'File: 50%\n▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱');
    expect(message.edit).toHaveBeenLastCalledWith('File: 100%');
  });

  it('does nothing before init and safely completes without a message', async () => {
    const { sendable } = createSendable();
    const display = new DownloaderDisplay(sendable as never, 'File');
    display.update(500);
    await display.done();
    expect(sendable.send).not.toHaveBeenCalled();
  });
});
