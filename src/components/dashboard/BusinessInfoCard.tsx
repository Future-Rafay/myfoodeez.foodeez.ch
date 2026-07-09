"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Globe } from "lucide-react";
import Image from "next/image";
import { business_detail_view_all } from "../../../prisma/generated/prisma/client";
import { resolveMediaUrl } from "@/lib/media";

interface BusinessInfoCardProps {
  business: business_detail_view_all;
}

export function BusinessInfoCard({ business }: BusinessInfoCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-start gap-6 p-6">
        {/* Business Images */}
        <div className="flex-shrink-0 space-y-4">
          {/* Logo */}
          {/* <div className="relative w-32 h-32 mx-auto md:mx-0 rounded-xl overflow-hidden border-2 border-muted shadow-md">
            {business.LOGO ? (
              <Image
                src={business.LOGO}
                alt={business.BUSINESS_NAME || 'Business Logo'}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Image 
                  src="/images/Logo/LogoFoodeezMain.svg" 
                  alt="Default Logo" 
                  width={48} 
                  height={48}
                />
              </div>
            )}
          </div> */}
          
          {/* Cover Image - Optional */}
          {resolveMediaUrl(business.IMAGE_URL) && (
            <div className="relative w-32 h-32 mx-auto md:mx-0 rounded-xl overflow-hidden border-2 border-muted shadow-md">
              <Image
                src={resolveMediaUrl(business.IMAGE_URL)!}
                alt={business.BUSINESS_NAME || 'Business Cover'}
                fill
                className="object-cover"
              />
            </div>
          )}
        </div>

        {/* Business Info */}
        <div className="flex-grow space-y-6">
          {/* Business Name and Type */}
          <div>
            <CardTitle className="text-2xl font-bold text-foodeez-primary text-center md:text-left">
              {business.BUSINESS_NAME}
            </CardTitle>
            {business.SHORT_NAME && (
              <p className="text-muted-foreground font-medium text-center md:text-left">
                {business.SHORT_NAME}
              </p>
            )}
          </div>

          {/* Business Type Badges */}
          <div className="flex flex-wrap gap-2">
            {business.VEGAN === 1 && (
              <Badge variant="outline" className="bg-green-500/90 text-white border-none">
                Vegan
              </Badge>
            )}
            {business.VEGETARIAN === 1 && (
              <Badge variant="outline" className="bg-green-500/90 text-white border-none">
                Vegetarian
              </Badge>
            )}
            {business.HALAL === 1 && (
              <Badge variant="outline" className="bg-blue-500/90 text-white border-none">
                Halal
              </Badge>
            )}
            {business.HAVING_ACTIVE_MENU_CARD === 1 && (
              <Badge className="bg-foodeez-primary text-white border-none">
                Active Menu
              </Badge>
            )}
          </div>

          {/* Contact Information */}
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              {business.ADDRESS_STREET && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-foodeez-primary flex-shrink-0" />
                  <span>{business.ADDRESS_STREET}, {business.ADDRESS_TOWN}</span>
                </div>
              )}
              {business.PHONE_NUMBER && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 text-foodeez-primary flex-shrink-0" />
                  <span>{business.PHONE_NUMBER}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {business.EMAIL_ADDRESS && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 text-foodeez-primary flex-shrink-0" />
                  <span className="break-all">{business.EMAIL_ADDRESS}</span>
                </div>
              )}
              {business.WEB_ADDRESS && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-4 h-4 text-foodeez-primary flex-shrink-0" />
                  <a 
                    href={business.WEB_ADDRESS} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-foodeez-primary transition-colors break-all"
                  >
                    {business.WEB_ADDRESS}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Description if available */}
          {business.DESCRIPTION && (
            <p className="text-muted-foreground border-t pt-4">
              {business.DESCRIPTION}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
} 
