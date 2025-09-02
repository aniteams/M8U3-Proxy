import axios from "axios";
import { Request, Response } from "express";
import { allowedExtensions, LineTransform } from "../utils/line-transform";

export const m3u8Proxy = async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    const customReferer = req.query.referer as string;
    if (!url) return res.status(400).json("url is required");

    const isStaticFiles = allowedExtensions.some(ext => url.endsWith(ext));
    const baseUrl = url.replace(/[^/]+$/, "");

    const defaultHeaderOptions = [
      { Referer: "https://megaplay.buzz/", Origin: "https://megaplay.buzz" },
      { Referer: "https://vidwish.live/", Origin: "https://vidwish.live" },
      { Referer: "https://kwik.cx/", Origin: "https://kwik.cx" },
      { Referer: "https://tubeplx.viddsn.cfd/", Origin: "https://tubeplx.viddsn.cfd" }
    ];

    let headerOptions;
    if (customReferer) {
      try {
        const refererUrl = new URL(customReferer);
        headerOptions = [{
          Referer: customReferer,
          Origin: refererUrl.origin
        }];
      } catch {
        return res.status(400).json("Invalid referer URL");
      }
    } else {
      headerOptions = defaultHeaderOptions;
    }

    let response;
    let lastError;

    for (const headers of headerOptions) {
      try {
        const reqHeaders: any = {
          Accept: "*/*",
          Referer: headers.Referer
        };
        if (headers.Origin) {
          reqHeaders.Origin = headers.Origin;
        }

        
        console.log("Axios request headers:", reqHeaders);

        response = await axios.get(url, {
          responseType: 'stream',
          headers: reqHeaders
        });
        break; // success
      } catch (err: any) {
        lastError = err;
        if (err.response?.status !== 403 && err.response?.status !== 401) {
          break;
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
