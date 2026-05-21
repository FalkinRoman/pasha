/** За сколько минут до startAt открывается доступ в клуб */
export const DOOR_EARLY_MIN = 15;

/** startAt в пределах N мин от «сейчас» = бронь «сейчас», endAt сдвигается после приёмки */
export const WALK_IN_START_MIN = 10;

/** Минимальный остаток для возврата при досрочном завершении */
export const REFUND_MIN_REMAINING_MIN = 30;

/** После startAt без входа → no_show */
export const NO_SHOW_GRACE_MIN = 30;

/** Бронь «сейчас»: запас на вход + приёмку до старта игрового таймера */
export const ACCEPTANCE_BUFFER_MIN = 45;
