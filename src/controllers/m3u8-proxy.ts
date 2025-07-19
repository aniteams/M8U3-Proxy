import axios from "axios";
import { Request, Response } from "express";
import { allowedExtensions, LineTransform } from "../utils/line-transform";

export const m3u8Proxy = async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    if (!url) return res.status(400).json("url is required");

    const isStaticFiles = allowedExtensions.some(ext => url.endsWith(ext));
    const baseUrl = url.replace(/[^/]+$/, "");

    // List of Referer/Origin combinations to try
    const headerOptions = [
      { Referer: "https://megaplay.buzz/", Origin: "https://megaplay.buzz" },
      { Referer: "https://vidwish.live/", Origin: "https://vidwish.live" },
      { Referer: "https://kwik.cx/", Origin: "https://kwik.cx" },
      { Referer: "https://tubeplx.viddsn.cfd/", Origin: "https://tubeplx.viddsn.cfd" }
    ];

    let response;
    let lastError;

    for (const headers of headerOptions) {
      try {
        response = await axios.get(url, {
          responseType: 'stream',
          headers: {
            Accept: "*/*",
            Referer: headers.Referer,
            Origin: headers.Origin
          }
        });
        break; // If successful, break out of the loop
      } catch (err: any) {
        lastError = err;
        if (err.response?.status !== 403 && err.response?.status !== 401) {
          break; // If error is not 403/401, break the loop (e.g., 404)
        }
      }
    }

    if (!response) throw lastError;

    const headers = { ...response.headers };
    if (!isStaticFiles) delete headers['content-length'];

    res.cacheControl = { maxAge: headers['cache-control'] };
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Headers"] = "*";
    headers["Access-Control-Allow-Methods"] = "*";
    res.set(headers);

    if (isStaticFiles || !url.endsWith(".m3u8")) {
      return response.data.pipe(res);
    }

    const transform = new LineTransform(baseUrl);
    response.data.pipe(transform).pipe(res);
  } catch (error: any) {
    console.log(error.message);
    res.status(500).send('Internal Server Error');
  }
};
