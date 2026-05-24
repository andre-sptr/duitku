import React from "react";
import { LucideIcon } from "lucide-react-native";
import {
  Wallet, Landmark, CreditCard, PiggyBank, Smartphone, Coins,
  Utensils, Fuel, Shirt, Coffee, ChefHat, Sparkles, Heart, Wifi,
  Home, Wrench, HandHeart, Send, AlertCircle, MoreHorizontal,
  Briefcase, Award, Gift, TrendingUp, Tag, ShoppingBag, ShoppingCart,
  Car, Plane, Train, Bus, BookOpen, GraduationCap, Stethoscope,
  Pill, Dumbbell, Music, Film, Gamepad2, Camera, Plug, Lightbulb,
  Droplet, Flame, Phone, Tv, Gem, Baby, PawPrint, Trees,
} from "lucide-react-native";

const ICON_MAP: Record<string, LucideIcon> = {
  // Accounts
  Wallet, Landmark, CreditCard, PiggyBank, Smartphone, Coins,
  // Expense
  Utensils, Fuel, Shirt, Coffee, ChefHat, Sparkles, Heart, Wifi,
  Home, Wrench, HandHeart, Send, AlertCircle, MoreHorizontal,
  // Income
  Briefcase, Award, Gift, TrendingUp,
  // Extra
  Tag, ShoppingBag, ShoppingCart, Car, Plane, Train, Bus,
  BookOpen, GraduationCap, Stethoscope, Pill, Dumbbell,
  Music, Film, Gamepad2, Camera, Plug, Lightbulb,
  Droplet, Flame, Phone, Tv, Gem, Baby, PawPrint, Trees,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export const ACCOUNT_ICONS = [
  "Wallet", "Landmark", "CreditCard", "PiggyBank", "Smartphone", "Coins",
];

export const CATEGORY_ICONS = [
  "Utensils", "Coffee", "ShoppingBag", "ShoppingCart", "Fuel", "Car",
  "Home", "Shirt", "Heart", "Wifi", "Phone", "Tv",
  "BookOpen", "GraduationCap", "Stethoscope", "Pill", "Dumbbell",
  "Music", "Film", "Gamepad2", "Camera", "Plane", "Train", "Bus",
  "Briefcase", "Award", "Gift", "TrendingUp", "Gem", "Baby", "PawPrint",
  "Trees", "Lightbulb", "Droplet", "Flame", "Plug",
  "ChefHat", "Sparkles", "HandHeart", "Send", "Wrench", "AlertCircle",
  "Tag", "MoreHorizontal",
];

export const COLOR_PALETTE = [
  "#4F46E5", "#6366F1", "#10B981", "#F59E0B", "#F97316",
  "#EF4444", "#EC4899", "#A855F7", "#8B5CF6", "#3B82F6",
  "#0EA5E9", "#14B8A6", "#22C55E", "#EAB308", "#FB7185",
  "#92400E", "#64748B", "#475569",
];

export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Tag;
}

type Props = {
  name: string;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 24, color = "#2C2C2C" }: Props) {
  const Cmp = getIcon(name);
  return <Cmp size={size} color={color} />;
}
