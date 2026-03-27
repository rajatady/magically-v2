import { describe, expect, it, vi, beforeEach } from 'vitest';
import { io } from 'socket.io-client';
import { connectSocket, disconnectSocket } from './socket';

const mockOn = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ connected: false, on: vi.fn(), disconnect: vi.fn() })),
}));

describe('socket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    disconnectSocket();

    // Set up fresh mock return value for each test
    (io as ReturnType<typeof vi.fn>).mockReturnValue({
      connected: false,
      on: mockOn,
      disconnect: mockDisconnect,
    });
  });

  it('connectSocket creates a connection', () => {
    connectSocket();
    expect(io).toHaveBeenCalled();
    expect(mockOn).toHaveBeenCalled();
  });

  it('connectSocket is idempotent when already connected', () => {
    // First call creates socket
    (io as ReturnType<typeof vi.fn>).mockReturnValue({
      connected: true,
      on: mockOn,
      disconnect: mockDisconnect,
    });
    connectSocket();
    const callCount = (io as ReturnType<typeof vi.fn>).mock.calls.length;

    // Second call should not create another
    connectSocket();
    expect((io as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
  });

  it('disconnectSocket calls disconnect and is safe when no socket', () => {
    connectSocket();
    disconnectSocket();
    expect(mockDisconnect).toHaveBeenCalled();

    // Safe to call again when no socket exists
    mockDisconnect.mockClear();
    disconnectSocket();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });
});
