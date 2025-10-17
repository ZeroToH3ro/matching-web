"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useFormContext } from "react-hook-form";
import { useState } from "react";

export default function ProfileDetailsForm() {
  const {
    register,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    getValues("dateOfBirth") ? new Date(getValues("dateOfBirth")) : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const genderList = [
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="Enter your name"
          {...register("name")}
          className={cn(errors.name && "border-red-500")}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message as string}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="gender">Gender</Label>
        <Select
          value={getValues("gender")}
          onValueChange={(value) => setValue("gender", value, { shouldValidate: true })}
        >
          <SelectTrigger className={cn(errors.gender && "border-red-500")}>
            <SelectValue placeholder="Select your gender" />
          </SelectTrigger>
          <SelectContent>
            {genderList.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.gender && (
          <p className="text-sm text-red-500">{errors.gender.message as string}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal bg-white",
                !selectedDate && "text-muted-foreground",
                errors.dateOfBirth && "border-red-500"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-white max-w-[calc(100vw-2rem)]" align="start" side="bottom" sideOffset={4}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  const formattedDate = format(date, "yyyy-MM-dd");
                  setValue("dateOfBirth", formattedDate, { shouldValidate: true, shouldDirty: true });
                  setIsCalendarOpen(false);
                }
              }}
              disabled={(date) => {
                const today = new Date();
                const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
                return date > eighteenYearsAgo || date > today;
              }}
              defaultMonth={new Date(new Date().getFullYear() - 25, 0, 1)}
              className="scale-90 sm:scale-100"
            />
          </PopoverContent>
        </Popover>
        <input type="hidden" {...register("dateOfBirth")} />
        {errors.dateOfBirth && (
          <p className="text-sm text-red-500">{errors.dateOfBirth.message as string}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Tell us about yourself"
          {...register("description")}
          className={cn("min-h-[100px]", errors.description && "border-red-500")}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message as string}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          placeholder="Enter your city"
          {...register("city")}
          className={cn(errors.city && "border-red-500")}
        />
        {errors.city && (
          <p className="text-sm text-red-500">{errors.city.message as string}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          placeholder="Enter your country"
          {...register("country")}
          className={cn(errors.country && "border-red-500")}
        />
        {errors.country && (
          <p className="text-sm text-red-500">{errors.country.message as string}</p>
        )}
      </div>
    </div>
  );
}
