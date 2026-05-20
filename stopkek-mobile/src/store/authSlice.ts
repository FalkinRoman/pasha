import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  hasSeenWelcome: boolean;
  hydrated: boolean;
  needsProfileSetup: boolean;
  user: User | null;
  pendingPhone: string;
  accessToken: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  hasSeenWelcome: false,
  hydrated: false,
  needsProfileSetup: false,
  user: null,
  pendingPhone: '',
  accessToken: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setHydrated(state) {
      state.hydrated = true;
    },
    setWelcomeSeen(state) {
      state.hasSeenWelcome = true;
    },
    setPendingPhone(state, action: PayloadAction<string>) {
      state.pendingPhone = action.payload;
    },
    setNeedsProfileSetup(state, action: PayloadAction<boolean>) {
      state.needsProfileSetup = action.payload;
    },
    loginSuccess(
      state,
      action: PayloadAction<{
        user: User;
        accessToken?: string;
        needsProfileSetup?: boolean;
      }>
    ) {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      if (action.payload.accessToken) state.accessToken = action.payload.accessToken;
      if (action.payload.needsProfileSetup !== undefined) {
        state.needsProfileSetup = action.payload.needsProfileSetup;
      }
    },
    updateUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.needsProfileSetup = !action.payload.profileCompleted;
    },
    updateUserName(state, action: PayloadAction<string>) {
      if (state.user) {
        state.user.name = action.payload;
        state.user.profileCompleted = true;
        state.needsProfileSetup = false;
      }
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
      state.pendingPhone = '';
      state.accessToken = null;
      state.needsProfileSetup = false;
    },
  },
});

export const {
  setHydrated,
  setWelcomeSeen,
  setPendingPhone,
  setNeedsProfileSetup,
  loginSuccess,
  updateUser,
  updateUserName,
  logout,
} = authSlice.actions;
export default authSlice.reducer;
