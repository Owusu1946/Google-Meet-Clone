import { clerkMiddleware } from '@clerk/nextjs/server';

// Pages support guests; handlers enforce identity and membership.
export default clerkMiddleware();
export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ico|woff2?|ttf)).*)', '/(api|trpc)(.*)'],
};
