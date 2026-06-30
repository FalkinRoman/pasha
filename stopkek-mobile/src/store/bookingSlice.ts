import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Booking, BookingPriceQuote, ClubSummary, Seat, Zone } from '../types';
import type { ClubPricing } from '../api/club';

interface BookingState {
  seats: Seat[];
  zones: Zone[];
  club: ClubSummary | null;
  clubPricing: ClubPricing | null;
  selectedSeatIds: string[];
  startAt: string | null;
  durationHours: number;
  activePackageId: string | null;
  calculatedPrice: number;
  priceQuote: BookingPriceQuote | null;
  pendingBookingId: string | null;
  activeBooking: Booking | null;
}

const initialState: BookingState = {
  seats: [],
  zones: [],
  club: null,
  clubPricing: null,
  selectedSeatIds: [],
  startAt: null,
  durationHours: 1,
  activePackageId: null,
  calculatedPrice: 0,
  priceQuote: null,
  pendingBookingId: null,
  activeBooking: null,
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    clearSeatSelection(state) {
      state.selectedSeatIds = [];
    },
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
    setActivePackageId(state, action: PayloadAction<string | null>) {
      state.activePackageId = action.payload;
    },
    setStartAt(state, action: PayloadAction<string>) {
      state.startAt = action.payload;
    },
    setCalculatedPrice(state, action: PayloadAction<number>) {
      state.calculatedPrice = action.payload;
    },
    setPriceQuote(state, action: PayloadAction<BookingPriceQuote | null>) {
      state.priceQuote = action.payload;
    },
    setPendingBookingId(state, action: PayloadAction<string | null>) {
      state.pendingBookingId = action.payload;
    },
    clearDraft(state) {
      state.selectedSeatIds = [];
      state.activePackageId = null;
      state.calculatedPrice = 0;
      state.priceQuote = null;
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
    setClubPricing(state, action: PayloadAction<ClubPricing | null>) {
      state.clubPricing = action.payload;
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
  clearSeatSelection,
  setDuration,
  setActivePackageId,
  setStartAt,
  setCalculatedPrice,
  setPriceQuote,
  setPendingBookingId,
  clearDraft,
  setActiveBooking,
  setSeats,
  setZones,
  setClub,
  setClubPricing,
  setFloorMap,
} = bookingSlice.actions;
export default bookingSlice.reducer;
