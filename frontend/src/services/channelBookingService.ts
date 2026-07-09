import api from './authService';

// Booking-channel contract (docs/launch-plan.md — "Locked interface
// contracts"). The backend proxies availability from the PMS and creates
// confirmed bookings in it; these shapes are hand-written on purpose — do
// NOT regenerate them from the OpenAPI spec until the contract stabilises.

export type Property = 'hf' | 'hfville';

export interface ChannelRoomType {
  room_type_id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  nightly_price: number;
  available_count: number;
}

export interface ChannelAvailabilityResponse {
  property: Property;
  check_in: string;
  check_out: string;
  room_types: ChannelRoomType[];
}

export type PaymentOption = 'deposit50' | 'full';

export interface CreateChannelBookingRequest {
  property: Property;
  room_type_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  guest_name: string;
  guest_phone: string;
  payment_option: PaymentOption;
}

export interface ChannelBookingResponse {
  booking_id: string;
  pms_booking_id: string;
  total_amount: number;
  amount_due_now: number;
  balance_due_at_checkin: number;
  promptpay_qr_payload: string;
  hold_expires_at: string;
}

export const channelBookingService = {
  async getAvailability(
    property: Property,
    checkIn: string,
    checkOut: string,
    guests: number,
  ): Promise<ChannelAvailabilityResponse> {
    const response = await api.get<ChannelAvailabilityResponse>('/bookings/availability', {
      params: {
        property,
        check_in: checkIn,
        check_out: checkOut,
        guests,
      },
    });
    return response.data;
  },

  async createBooking(data: CreateChannelBookingRequest): Promise<ChannelBookingResponse> {
    const response = await api.post<ChannelBookingResponse>('/bookings/channel', data);
    return response.data;
  },
};
