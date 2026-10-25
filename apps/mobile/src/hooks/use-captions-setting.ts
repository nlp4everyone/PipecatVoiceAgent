import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "captionsOn";

/** CC on/off, remembered between app launches. Defaults to on. */
export function useCaptionsSetting() {
  const [captionsOn, setCaptionsOn] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((value) => {
        if (value !== null) setCaptionsOn(value === "1");
      })
      .catch(() => {});
  }, []);

  const toggleCaptions = useCallback(() => {
    setCaptionsOn((prev) => {
      AsyncStorage.setItem(KEY, prev ? "0" : "1").catch(() => {});
      return !prev;
    });
  }, []);

  return { captionsOn, toggleCaptions };
}
