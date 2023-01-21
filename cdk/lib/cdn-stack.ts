import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";

import { HttpsRedirect } from "aws-cdk-lib/aws-route53-patterns";

interface Props extends cdk.StageProps {
  loadBalancer: cdk.aws_elasticloadbalancingv2.ApplicationLoadBalancer;
  bucket: cdk.aws_s3.Bucket;
  production?: boolean;
}

export class CdnStack extends cdk.Stack {
  public readonly appLoadBalancerDNS: cdk.CfnOutput;
  public readonly appPort: number = 3000;
  public readonly cloudMapNamespace = "service.internal";

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    const { bucket, loadBalancer } = props;

    const domainName = ssm.StringParameter.valueForStringParameter(
      this,
      `/env/domainName`,
      1
    );

    const hostedZoneId = ssm.StringParameter.valueForStringParameter(
      this,
      `/env/hostedZoneId`,
      1
    );

    const wwwDomainName = `www.${domainName}`;

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "MyZone", {
      hostedZoneId,
      zoneName: domainName,
    });

    const certificate = new acm.DnsValidatedCertificate(this, "Certificate", {
      domainName,
      subjectAlternativeNames: [`*.${domainName}`],
      hostedZone: zone,
      region: "us-east-1",
    });

    const webCf = new cloudfront.Distribution(this, "myDist", {
      domainNames: [wwwDomainName],
      certificate,
      defaultBehavior: {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        origin: new origins.LoadBalancerV2Origin(loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        functionAssociations: [
          {
            function: new cloudfront.Function(this, "Function", {
              code: cloudfront.FunctionCode.fromInline(`
                  function handler(event) {
                    var host = event.request.headers.host.value;
                    var request = event.request;
                    if (host.includes("cloudfront")) {
                      var response = {
                        statusCode: 404,
                        statusDescription: "Not found",
                      };
                      return response;
                    }
                    return request;
                  }                  
                `),
            }),
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
    });

    new route53.ARecord(this, "SiteAliasRecord", {
      recordName: wwwDomainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(webCf)
      ),
      zone,
    });

    new route53.AaaaRecord(this, "Alias", {
      zone,
      recordName: wwwDomainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(webCf)
      ),
    });

    new HttpsRedirect(this, "Redirect", {
      recordNames: [domainName],
      targetDomain: wwwDomainName,
      zone: route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
        hostedZoneId,
        zoneName: domainName,
      }),
    });
  }
}
