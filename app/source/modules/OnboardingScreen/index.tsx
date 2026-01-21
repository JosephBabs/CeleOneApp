import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { useTranslation } from "react-i18next";
import LinearGradient from "react-native-linear-gradient";
import { d_assets } from "../../configs/assets";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    titleKey: "onboard.title1",
    textKey: "onboard.text1", 
    image: d_assets.images.onboardingSlide1,
  },
  {
    id: "2",
    titleKey: "onboard.title2",
    textKey: "onboard.text2",
    image: d_assets.images.onboardingSlide2,
  },
  {
    id: "3",
    titleKey: "onboard.title3",
    textKey: "onboard.text3",
    image: d_assets.images.onboardingSlide3,
  },
];

const OnboardingScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      navigation.replace("Login");
    }
  };

  const handleSkip = () => {
    navigation.replace("Login");
  };

  const renderPagination = () => (
    <View style={styles.pagination}>
      {slides.map((_, i) => {
        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 20, 8],
          extrapolate: "clamp",
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: "clamp",
        });
        return (
          <Animated.View
            key={i}
            style={[styles.dot, { width: dotWidth, opacity }]}
          />
        );
      })}
    </View>
  );

  return (
    <LinearGradient
      colors={["#E0F7FA", "#FDFEFF"]}
      style={styles.container}
    >
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>{t("onboard.skip")}</Text>
      </TouchableOpacity>

      <Animated.FlatList
        data={slides}
        ref={flatListRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image source={item.image} style={styles.image} />
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.text}>{t(item.textKey)}</Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
      />

      {renderPagination()}

      <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
        <Text style={styles.nextText}>
          {currentIndex === slides.length - 1
            ? t("onboard.start")
            : t("onboard.next")}
        </Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 40,
  },
  skipBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 1,
  },
  skipText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  slide: {
    width,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  image: {
    width: width * 1,
    height: width * 0.6,
    resizeMode: "contain",
    marginBottom: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#222",
    textAlign: "center",
    marginBottom: 15,
  },
  text: {
    fontSize: 16,
    color: "#444",
    textAlign: "center",
    paddingHorizontal: 10,
    lineHeight: 22,
  },
  pagination: {
    flexDirection: "row",
    alignSelf: "center",
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#64C7C3",
    marginHorizontal: 4,
  },
  nextBtn: {
    backgroundColor: "#64C7C3",
    marginHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: "center",
  },
  nextText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default OnboardingScreen;
