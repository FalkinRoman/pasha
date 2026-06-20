import { fetchFloorMap } from '../api/club';
import { setFloorMap } from '../store/bookingSlice';
import type { AppDispatch } from '../store';

export async function reloadFloorMap(dispatch: AppDispatch) {
  const floor = await fetchFloorMap();
  dispatch(setFloorMap({ seats: floor.seats, zones: floor.zones }));
  return floor;
}
