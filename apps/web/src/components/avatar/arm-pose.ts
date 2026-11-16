// Tư thế tay không phụ thuộc three, để các file nằm trong bundle chính (như `use-avatar-state.ts`, được
// `voice-screen.tsx` import không lazy) import được mà không kéo three và @pixiv/three-vrm vào đường tải đầu tiên.
// Đừng import `three` hay `@pixiv/three-vrm` vào file này. `vrm-frame.ts` re-export các tên ở đây.

// Cùng công thức với `MathUtils.degToRad` của three (`degrees * DEG2RAD`), để giá trị giống hệt từng bit.
const DEG2RAD = Math.PI / 180;
const degToRad = (degrees: number) => degrees * DEG2RAD;

/** Góc hạ tay khỏi tư thế chữ T (radian). */
export const ARM_RAD = degToRad(58);

/**
 * Tư thế một tay (góc radian, dùng cho cả hai bên: bên phải đảo dấu y và z, giữ x).
 * Trục đo ở 4.7.0.2 (docs/plans/avatar-3d/phase-4.md): z của vai và cánh tay trên là hạ xuống;
 * x của cánh tay trên dương là đưa ra trước (cả hai bên); y của khuỷu và cổ tay âm là gập ra trước; z của khuỷu dương là đưa vào phía thân; z của ngón dương là cong về lòng bàn tay
 * (đo ở 4.7.1.1).
 */
export interface ArmPose {
  /** Vai: dương là hạ vai, âm là nhún lên (trục z). */
  shoulderZ: number;
  /** Hạ cánh tay trên khỏi tư thế chữ T (trục z). */
  upperZ: number;
  /** Đưa cánh tay trên ra trước (x dương là ra trước và lên, đo ở 4.7.3a.1). Cùng dấu cho cả hai bên. */
  upperX: number;
  /** Khuỷu gập ra trước (y, âm là gập) và đưa vào thân (z, dương). */
  lowerY: number;
  lowerZ: number;
  /** Cổ tay gập ra trước (y, âm là gập). */
  handY: number;
  /** Ngón cong về phía lòng bàn tay (z dương) ở đốt gần, đốt giữa, đốt xa của bốn ngón dài, và ngón cái. */
  fingerProximal: number;
  fingerIntermediate: number;
  fingerDistal: number;
  thumb: number;
  /**
   * Ngón cái vắt ngang lòng bàn tay (đo ở 4.7.3a.1): đốt gốc xoay y dương là đưa về phía ngón út, z là cong;
   * đốt cuối cong theo z. Cả ba đều 0 ở tư thế nghỉ. Dấu y và z đảo cho tay phải như các trường khác.
   */
  thumbMetacarpalY: number;
  thumbMetacarpalZ: number;
  thumbDistal: number;
}

/** Tư thế nghỉ (4.7.1): hạ tay bằng cả vai và cánh tay, gập nhẹ khuỷu, cổ tay thả lỏng. Giá trị khởi đầu, chỉnh bằng mắt. */
export const REST_ARM: ArmPose = {
  shoulderZ: degToRad(6),
  upperZ: degToRad(55),
  upperX: 0,
  lowerY: degToRad(-8),
  lowerZ: degToRad(3),
  handY: degToRad(-3),
  // Giá trị khởi đầu (4.7.1.1), chỉnh bằng mắt trên trang debug.
  fingerProximal: degToRad(15),
  fingerIntermediate: degToRad(20),
  fingerDistal: degToRad(10),
  thumb: degToRad(8),
  thumbMetacarpalY: 0,
  thumbMetacarpalZ: 0,
  thumbDistal: 0,
};
