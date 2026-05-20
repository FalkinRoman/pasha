import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Booking, ClubSummary, Seat, Zone } from '../types';

interface BookingState {
  seats: Seat[];
  zones: Zone[];
  club: ClubSummary | null;
  selectedSeatIds: string[];
  startAt: string | null;
  durationHours: number;
  calculatedPrice: number;
  pendingBookingId: string | null;
  activeBooking: Booking | null;
}

const initialState: BookingState = {
  seats: [],
  zones: [],
  club: null,
  selectedSeatIds: [],
  startAt: null,
  durationHours: 2,
  calculatedPrice: 0,
  pendingBookingId: null,
  activeBooking: null,
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    toggleSeat(state, action: PayloadAction<string>) {
      const id = action.payload;
      const seat = state.seats.find((s) => s.id === id);
      if (!seat || seat.status !== 'free') return;
      if (state.selectedSeatIds.includes(id)) {
        state.selectedSeatIds = state.selectedSeatIds.filter((x) => x !== id);
      } else {
        state.selectedSeatIds = [id];
      }
    },
    setDuration(state, action: PayloadAction<number>) {
      state.durationHours = action.payload;
    },
    setStartAt(state, action: PayloadAction<string>) {
      state.startAt = action.payload;
    },
    setCalculatedPrice(state, action: PayloadAction<number>) {
      state.calculatedPrice = action.payload;
    },
    setPendingBookingId(state, action: PayloadAction<string | null>) {
      state.pendingBookingId = action.payload;
    },
    clearDraft(state) {
      state.selectedSeatIds = [];
      state.calculatedPrice = 0;
      state.pendingBookingId = null;
    },
    setActiveBooking(state, action: PayloadAction<Booking | null>) {
      state.activeBooking = action.payload;
    },
    setSeats(state, action: PayloadAction<Seat[]>) {
      state.seats = action.payload;
    },
    setZones(state, action: PayloadAction<Zone[]>) {
      state.zones = action.payload;
    },
    setClub(state, action: PayloadAction<ClubSummary>) {
      state.club = action.payload;
    },
    setFloorMap(
      state,
      action: PayloadAction<{ seats: Seat[]; zones: Zone[] }>
    ) {
      state.seats = action.payload.seats;
      state.zones = action.payload.zones;
    },
  },
});

export const {
  toggleSeat,
  setDuration,
  setStartAt,
  setCalculatedPrice,
  setPendingBookingId,
  clearDraft,
  setActiveBooking,
  setSeats,
  setZones,
  setClub,
  setFloorMap,
} = bookingSlice.actions;
export default bookingSlice.reducer;
